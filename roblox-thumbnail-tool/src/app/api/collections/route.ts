import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiRoute, jsonResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { enqueueJob } from '@/lib/queue';

// Zod Discriminated Union schema matching the legacy collection modes
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

// GET /api/collections — Get a list of crawl jobs
export async function GET(request: NextRequest) {
  return handleApiRoute(async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

    const jobs = await db.collectionJob.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        strategy: true,
        status: true,
        progress: true,
        processedItems: true,
        successItems: true,
        failedItems: true,
        totalItems: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        _count: { select: { thumbnails: true, dlqEntries: true } },
      },
    });

    return jsonResponse(jobs);
  });
}

// POST /api/collections — Create and queue a new collection crawl
export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    const body = await request.json();
    const validated = createJobSchema.parse(body);

    const job = await db.collectionJob.create({
      data: {
        name: validated.name ?? null,
        strategy: validated.strategy,
        config: JSON.stringify(validated),
        status: 'pending',
      },
    });

    // Enqueue job ID in the serverless Upstash Redis queue
    await enqueueJob(job.id);

    return jsonResponse(
      {
        message: 'Collection job successfully created and enqueued',
        job: {
          id: job.id,
          strategy: job.strategy,
          status: job.status,
          createdAt: job.createdAt,
        },
      },
      202
    );
  });
}
