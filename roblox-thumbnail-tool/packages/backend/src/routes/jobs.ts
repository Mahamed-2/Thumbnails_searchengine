// =============================================================================
// src/routes/jobs.ts — Collection job management routes (Phase 3: BullMQ wired)
// =============================================================================

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '@database/client';
import { NotFoundError } from '../middleware/errorHandler';
import { enqueueThumbnailJob, getQueueStats } from '@queue/queues';
import { thumbnailJobSchema } from '@queue/jobSchemas';

export const jobsRouter = Router();

// ── Request Schemas ────────────────────────────────────────────────────────────
const createJobSchema = z.discriminatedUnion('strategy', [
  z.object({
    name: z.string().max(100).optional(),
    strategy: z.literal('user-range'),
    startUserId: z.number().int().positive(),
    endUserId: z.number().int().positive(),
    batchSize: z.number().int().min(1).max(100).default(100),
    sizes: z.array(z.string()).default(['420x420', '720x720']),
    cropTypes: z.array(z.enum(['avatar', 'avatar-bust', 'avatar-headshot'])).default(['avatar']),
    format: z.enum(['png', 'jpeg', 'webp']).default('png'),
    downloadImages: z.boolean().default(true),
  }),
  z.object({
    name: z.string().max(100).optional(),
    strategy: z.literal('game-search'),
    keyword: z.string().min(1).max(200),
    limit: z.number().int().positive().max(1000).default(100),
    sizes: z.array(z.string()).default(['512x512']),
    downloadImages: z.boolean().default(true),
  }),
  z.object({
    name: z.string().max(100).optional(),
    strategy: z.literal('popular-games'),
    limit: z.number().int().positive().max(1000).default(100),
    sizes: z.array(z.string()).default(['512x512']),
    downloadImages: z.boolean().default(true),
  }),
]);

// ── POST /api/v1/jobs — Create and enqueue a collection job ───────────────────
jobsRouter.post('/', async (req: Request, res: Response) => {
  const body = createJobSchema.parse(req.body);

  // Persist job record to DB first
  const dbJob = await db.collectionJob.create({
    data: {
      name: body.name ?? null,
      strategy: body.strategy,
      config: JSON.stringify(body),
      status: 'pending',
    },
  });

  // Build BullMQ job payload — validated by Zod discriminated union
  const jobPayload = thumbnailJobSchema.parse({
    jobId: dbJob.id,
    ...body,
  });

  // Enqueue with idempotency (same jobId = no duplicate)
  const bullJobId = await enqueueThumbnailJob(jobPayload);

  res.status(202).json({
    message: 'Job created and queued',
    job: {
      id: dbJob.id,
      bullJobId,
      strategy: dbJob.strategy,
      status: dbJob.status,
      createdAt: dbJob.createdAt,
    },
  });
});

// ── GET /api/v1/jobs — List recent jobs ───────────────────────────────────────
jobsRouter.get('/', async (req: Request, res: Response) => {
  const status = req.query['status'] as string | undefined;
  const limit = Math.min(Number(req.query['limit'] ?? 50), 200);

  const jobs = await db.collectionJob.findMany({
    ...(status ? { where: { status } } : {}),
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, name: true, strategy: true, status: true,
      progress: true, processedItems: true, successItems: true,
      failedItems: true, totalItems: true, startedAt: true,
      completedAt: true, createdAt: true,
      _count: { select: { thumbnails: true } },
    },
  });

  res.json(jobs);
});

// ── GET /api/v1/jobs/queue-stats — BullMQ queue stats ────────────────────────
jobsRouter.get('/queue-stats', async (_req: Request, res: Response) => {
  const stats = await getQueueStats();
  res.json(stats);
});

// ── GET /api/v1/jobs/:id — Get specific job with details ──────────────────────
jobsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params['id']!;
  const job = await db.collectionJob.findUnique({
    where: { id },
    include: {
      _count: { select: { thumbnails: true, dlqEntries: true } },
    },
  });
  if (!job) throw new NotFoundError('Job', id);
  res.json(job);
});

// ── POST /api/v1/jobs/:id/cancel — Cancel a running job ──────────────────────
jobsRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  const cancelId = req.params['id']!;
  const cancelJob = await db.collectionJob.findUnique({ where: { id: cancelId } });
  if (!cancelJob) throw new NotFoundError('Job', cancelId);

  if (!['pending', 'running'].includes(cancelJob.status)) {
    res.status(409).json({ error: `Cannot cancel job in status '${cancelJob.status}'` });
    return;
  }

  const updated = await db.collectionJob.update({
    where: { id: cancelId },
    data: { status: 'cancelled' },
  });

  // Worker polls cancellation status — it will detect 'cancelled' on next checkpoint
  res.json({ message: 'Cancellation requested', job: updated });
});

// ── POST /api/v1/jobs/:id/retry — Retry a failed job ─────────────────────────
jobsRouter.post('/:id/retry', async (req: Request, res: Response) => {
  const retryId = req.params['id']!;
  const existingJob = await db.collectionJob.findUnique({ where: { id: retryId } });
  if (!existingJob) throw new NotFoundError('Job', retryId);

  if (existingJob.status !== 'failed' && existingJob.status !== 'cancelled') {
    res.status(409).json({ error: `Cannot retry job in status '${existingJob.status}'` });
    return;
  }

  // Reset job and re-enqueue
  const resetJob = await db.collectionJob.update({
    where: { id: retryId },
    data: {
      status: 'pending',
      progress: 0,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      startedAt: null,
      completedAt: null,
      errorLog: null,
    },
  });

  const config = JSON.parse(existingJob.config);
  const jobPayload = thumbnailJobSchema.parse({ jobId: resetJob.id, ...config });
  const bullJobId = await enqueueThumbnailJob(jobPayload, {});

  res.status(202).json({ message: 'Job re-queued', job: resetJob, bullJobId });
});
