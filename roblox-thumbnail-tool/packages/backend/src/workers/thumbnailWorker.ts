// =============================================================================
// src/workers/thumbnailWorker.ts — Main BullMQ thumbnail collection worker
//
// Responsibilities:
//  1. Dequeue collection jobs (user-range / game-search / popular-games)
//  2. Fetch thumbnails from Roblox API in batches of 100
//  3. Download & validate images (Phase 4 pipeline — stubbed here with passthrough)
//  4. Deduplicate using pHash (Phase 4 — placeholder)
//  5. Store metadata to Prisma database
//  6. Save images to local FS (Phase 5 storage adapter — stubbed)
//  7. Checkpoint progress every N records for crash recovery
//  8. Emit real-time progress via progressEmitter
//  9. Send failed jobs to DLQ
// =============================================================================

import { Worker, type Job, type WorkerOptions } from 'bullmq';
import { createRedisConnection } from '@queue/redis';
import { createLogger } from '@observability/logger';
import { env } from '@config/env';
import { db } from '@database/client';
import { apiManager } from '@api/adapters';
import { progressEmitter } from '@workers/progressEmitter';
import { sendToDLQ, QUEUE_NAMES } from '@queue/queues';
import { thumbnailJobSchema, JOB_NAMES, type ThumbnailJobData, type JobProgress } from '@queue/jobSchemas';
import { queueJobsTotal, queueJobDuration, thumbnailsCollected, thumbnailsFailed } from '@observability/metrics';
import type { PlayerThumbnail } from '@app-types/roblox';
import { runPipeline } from '@pipeline/pipeline';
import { getStorageAdapter } from '@storage/index';

const logger = createLogger('thumbnail-worker');

// Checkpoint every N processed records to survive crashes
const CHECKPOINT_INTERVAL = 500;

// ── Worker Factory ─────────────────────────────────────────────────────────────
export function createThumbnailWorker(): Worker<ThumbnailJobData> {
  const workerOptions: WorkerOptions = {
    connection: createRedisConnection(),
    concurrency: env.QUEUE_CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000,
    },
  };

  const worker = new Worker<ThumbnailJobData>(
    QUEUE_NAMES.THUMBNAIL,
    async (job) => processJob(job),
    workerOptions,
  );

  // ── Worker event handlers ───────────────────────────────────────────────────
  worker.on('active', (job) => {
    logger.info({ jobId: job.data.jobId, bullJobId: job.id, strategy: job.data.strategy }, '▶️  Job started');
    progressEmitter.emitStatus(job.data.jobId, 'started');
  });

  worker.on('completed', (job) => {
    const duration = Date.now() - (job.timestamp ?? Date.now());
    queueJobsTotal.inc({ queue: QUEUE_NAMES.THUMBNAIL, status: 'completed' });
    queueJobDuration.observe({ queue: QUEUE_NAMES.THUMBNAIL, status: 'completed' }, duration / 1000);
    logger.info({ jobId: job.data.jobId, bullJobId: job.id, durationMs: duration }, '✅ Job completed');
    progressEmitter.emitStatus(job.data.jobId, 'completed');
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    queueJobsTotal.inc({ queue: QUEUE_NAMES.THUMBNAIL, status: 'failed' });

    logger.error(
      { jobId: job.data.jobId, bullJobId: job.id, error: err.message, attempts: job.attemptsMade },
      '❌ Job failed',
    );

    // If max attempts exhausted → send to DLQ and persist error
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await sendToDLQ(QUEUE_NAMES.THUMBNAIL, job.data, err);
      await persistDLQEntry(job.data.jobId, err);
    }

    progressEmitter.emitStatus(job.data.jobId, 'failed', err.message);
  });

  worker.on('error', (err) => {
    logger.error({ err }, '❌ Worker error');
  });

  logger.info(
    { concurrency: env.QUEUE_CONCURRENCY, queue: QUEUE_NAMES.THUMBNAIL },
    '⚙️  Thumbnail worker started',
  );

  return worker;
}

// ── Job Processor ──────────────────────────────────────────────────────────────
async function processJob(job: Job<ThumbnailJobData>): Promise<void> {
  // Validate and parse job data
  const data = thumbnailJobSchema.parse(job.data);
  const startedAt = new Date();

  // Mark job as running in DB
  await db.collectionJob.update({
    where: { id: data.jobId },
    data: { status: 'running', startedAt },
  });

  logger.info({ jobId: data.jobId, strategy: data.strategy }, '🔄 Processing job');

  try {
    switch (data.strategy) {
      case 'user-range':
        await processUserRangeJob(job, data);
        break;
      case 'game-search':
        await processGameSearchJob(job, data);
        break;
      case 'popular-games':
        await processPopularGamesJob(job, data);
        break;
    }

    // Mark complete in DB
    await db.collectionJob.update({
      where: { id: data.jobId },
      data: { status: 'completed', completedAt: new Date(), progress: 100 },
    });
  } catch (err) {
    await db.collectionJob.update({
      where: { id: data.jobId },
      data: {
        status: 'failed',
        errorLog: err instanceof Error ? err.message : String(err),
      },
    });
    throw err; // Re-throw so BullMQ handles retry/DLQ routing
  }
}

// ── User-Range Processor ───────────────────────────────────────────────────────
async function processUserRangeJob(
  job: Job<ThumbnailJobData>,
  data: Extract<ThumbnailJobData, { strategy: 'user-range' }>,
): Promise<void> {
  const totalUsers = data.endUserId - data.startUserId + 1;
  const totalItems = totalUsers * data.sizes.length * data.cropTypes.length;
  let processed = 0;
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  let batchIndex = 0;

  // Resume from checkpoint if available
  const resumeFromId = data.checkpoint ?? data.startUserId;
  if (data.checkpoint) {
    logger.info({ jobId: data.jobId, resumeFromId }, '⏩ Resuming from checkpoint');
  }

  await db.collectionJob.update({
    where: { id: data.jobId },
    data: { totalItems },
  });

  // Iterate over all combinations of sizes and crop types
  for (const size of data.sizes) {
    for (const cropType of data.cropTypes) {
      for (const batch of apiManager['roblox'].generateUserIdBatches(resumeFromId, data.endUserId, data.batchSize)) {
        if (await isJobCancelled(data.jobId)) {
          logger.info({ jobId: data.jobId }, '🛑 Job cancelled — stopping');
          await db.collectionJob.update({ where: { id: data.jobId }, data: { status: 'cancelled' } });
          return;
        }

        const opts: import('@app-types/roblox').ThumbnailFetchOptions = {
          size: size as import('@app-types/roblox').ThumbnailSize,
          cropType: cropType as import('@app-types/roblox').ThumbnailCropType,
          format: data.format as import('@app-types/roblox').ThumbnailFormat,
        };
        const thumbnails = await apiManager.fetchPlayerThumbnails(batch, opts);

        // Process each thumbnail in the batch
        const results = await Promise.allSettled(
          thumbnails.map((thumb) => processSingleThumbnail(thumb, data.jobId, size, cropType, data.downloadImages)),
        );

        for (const result of results) {
          processed++;
          if (result.status === 'fulfilled') {
            if (result.value === 'skipped') skipped++;
            else successful++;
          } else {
            failed++;
            thumbnailsFailed.inc({ reason: 'processing_error' });
          }
        }

        batchIndex++;

        // Emit progress
        const progress = buildProgress(processed, totalItems, successful, failed, skipped, batchIndex, 'collecting', batch[batch.length - 1]);
        await job.updateProgress(progress.percentage);
        progressEmitter.emitProgress(data.jobId, progress, job.id);

        // Checkpoint every N records
        if (processed % CHECKPOINT_INTERVAL === 0) {
          await checkpoint(data.jobId, processed, successful, failed, batch[batch.length - 1]);
          await persistJobProgress(data.jobId, processed, successful, failed, progress.percentage);
        }
      }
    }
  }

  // Final DB update
  await persistJobProgress(data.jobId, processed, successful, failed, 100);
  logger.info({ jobId: data.jobId, processed, successful, failed, skipped }, '✅ User-range job complete');
}

// ── Game-Search Processor ─────────────────────────────────────────────────────
async function processGameSearchJob(
  job: Job<ThumbnailJobData>,
  data: Extract<ThumbnailJobData, { strategy: 'game-search' }>,
): Promise<void> {
  logger.info({ jobId: data.jobId, keyword: data.keyword }, '🔍 Game search job');

  const games = await apiManager.searchGames(data.keyword, data.limit);
  const gameIds = games.map((g) => g.id);

  await db.collectionJob.update({
    where: { id: data.jobId },
    data: { totalItems: gameIds.length * data.sizes.length },
  });

  let processed = 0;
  let successful = 0;
  let failed = 0;

  for (const size of data.sizes) {
    const icons = await apiManager.fetchGameIcons(gameIds, size);

    // Upsert games and their icons
    for (const [i, game] of games.entries()) {
      const icon = icons.find((ic) => ic.targetId === game.id);
      processed++;

      try {
        await db.game.upsert({
          where: { robloxId: game.id },
          create: {
            robloxId: game.id,
            name: game.name,
            description: game.description,
            playing: game.playing,
            visits: BigInt(game.visits),
            maxPlayers: game.maxPlayers,
            thumbnailUrl: icon?.imageUrl ?? null,
          },
          update: {
            name: game.name,
            playing: game.playing,
            visits: BigInt(game.visits),
            thumbnailUrl: icon?.imageUrl ?? null,
            updatedAt: new Date(),
          },
        });
        successful++;
        thumbnailsCollected.inc({ crop_type: 'game-icon', size });
      } catch (err) {
        failed++;
        logger.warn({ gameId: game.id, err }, 'Failed to upsert game');
      }

      const progress = buildProgress(processed, gameIds.length * data.sizes.length, successful, failed, 0, i, 'collecting');
      await job.updateProgress(progress.percentage);
      progressEmitter.emitProgress(data.jobId, progress, job.id);
    }
  }

  await persistJobProgress(data.jobId, processed, successful, failed, 100);
}

// ── Popular-Games Processor ───────────────────────────────────────────────────
async function processPopularGamesJob(
  job: Job<ThumbnailJobData>,
  data: Extract<ThumbnailJobData, { strategy: 'popular-games' }>,
): Promise<void> {
  // Delegate to game-search without a keyword
  const asGameSearch = { ...data, strategy: 'game-search' as const, keyword: 'popular' };
  // Popular games: use getPopularGames instead
  const games = await apiManager.fetchPopularGames(data.limit);
  const gameIds = games.map((g) => g.id);

  await db.collectionJob.update({
    where: { id: data.jobId },
    data: { totalItems: gameIds.length },
  });

  let processed = 0;
  let successful = 0;
  let failed = 0;

  for (const size of data.sizes) {
    const icons = await apiManager.fetchGameIcons(gameIds, size);

    for (const [i, game] of games.entries()) {
      const icon = icons.find((ic) => ic.targetId === game.id);
      processed++;

      try {
        await db.game.upsert({
          where: { robloxId: game.id },
          create: {
            robloxId: game.id,
            name: game.name,
            description: game.description,
            playing: game.playing,
            visits: BigInt(game.visits),
            maxPlayers: game.maxPlayers,
            thumbnailUrl: icon?.imageUrl ?? null,
          },
          update: {
            playing: game.playing,
            visits: BigInt(game.visits),
            thumbnailUrl: icon?.imageUrl ?? null,
            updatedAt: new Date(),
          },
        });
        successful++;
      } catch (err) {
        failed++;
      }

      const progress = buildProgress(processed, gameIds.length, successful, failed, 0, i, 'collecting');
      await job.updateProgress(progress.percentage);
      progressEmitter.emitProgress(data.jobId, progress, job.id);
    }
  }

  // Suppress unused variable warning
  void asGameSearch;
  await persistJobProgress(data.jobId, processed, successful, failed, 100);
}

// ── Single Thumbnail Processor ─────────────────────────────────────────────────
async function processSingleThumbnail(
  thumbnail: PlayerThumbnail,
  jobId: string,
  size: string,
  cropType: string,
  downloadImages: boolean,
): Promise<'saved' | 'skipped'> {
  // Skip blocked / error states
  if (!thumbnail.imageUrl || thumbnail.state === 'Blocked' || thumbnail.state === 'Error') {
    return 'skipped';
  }

  // Upsert user record
  await db.user.upsert({
    where: { robloxId: thumbnail.targetId },
    create: { robloxId: thumbnail.targetId },
    update: {},
  });

  const [width, height] = size.split('x').map(Number);
  
  let pHash: string | null = null;
  let isDuplicate = false;
  let localPath: string | null = null;
  let cloudUrl: string | null = null;
  let fileSizeKb: number | null = null;
  let finalWidth = width ?? null;
  let finalHeight = height ?? null;
  let format = 'png';

  if (downloadImages) {
    const pipelineResult = await runPipeline(thumbnail.imageUrl, {
      ...(width !== undefined && !Number.isNaN(width) ? { width } : {}),
      ...(height !== undefined && !Number.isNaN(height) ? { height } : {}),
      format: 'png',
      userId: thumbnail.targetId,
    });

    if (pipelineResult.status === 'error') {
      logger.warn({ targetId: thumbnail.targetId, reason: pipelineResult.reason }, 'Pipeline error');
      return 'skipped';
    }

    pHash = pipelineResult.pHash ?? null;
    isDuplicate = pipelineResult.isDuplicate ?? false;

    if (pipelineResult.image) {
      finalWidth = pipelineResult.image.width;
      finalHeight = pipelineResult.image.height;
      format = pipelineResult.image.format;
      fileSizeKb = pipelineResult.image.sizeKb;

      if (!isDuplicate) {
        const storageAdapter = getStorageAdapter();
        const relativePath = `${cropType}/${size}/${thumbnail.targetId}.${format}`;
        const saveResult = await storageAdapter.save(pipelineResult.image.buffer, relativePath);
        localPath = saveResult.localPath ?? null;
        cloudUrl = saveResult.cloudUrl ?? null;
      }
    }
  }

  // Upsert thumbnail record (idempotent: unique on userId + size + cropType)
  await db.thumbnail.upsert({
    where: {
      userId_size_cropType: {
        userId: thumbnail.targetId,
        size,
        cropType,
      },
    },
    create: {
      userId: thumbnail.targetId,
      imageUrl: thumbnail.imageUrl,
      size,
      format,
      cropType,
      state: thumbnail.state,
      width: finalWidth,
      height: finalHeight,
      fileSizeKb,
      pHash,
      isDuplicate,
      localPath,
      cloudUrl,
      jobId,
    },
    update: {
      imageUrl: thumbnail.imageUrl,
      state: thumbnail.state,
      updatedAt: new Date(),
      // Optionally update other fields if we downloaded a newer version
      ...(pHash ? { pHash } : {}),
      ...(localPath ? { localPath } : {}),
      ...(cloudUrl ? { cloudUrl } : {}),
      ...(fileSizeKb ? { fileSizeKb } : {}),
    },
  });

  thumbnailsCollected.inc({ crop_type: cropType, size });

  return 'saved';
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildProgress(
  processed: number,
  total: number,
  successful: number,
  failed: number,
  skipped: number,
  batchIndex: number,
  phase: JobProgress['phase'],
  lastProcessedId?: number,
): JobProgress {
  const percentage = total > 0 ? Math.min(Math.round((processed / total) * 100), 100) : 0;
  return {
    processed, total, successful, failed, skipped,
    percentage, currentBatch: batchIndex,
    ...(lastProcessedId !== undefined ? { lastProcessedId } : {}),
    phase,
  };
}

async function isJobCancelled(jobId: string): Promise<boolean> {
  const job = await db.collectionJob.findUnique({ where: { id: jobId }, select: { status: true } });
  return job?.status === 'cancelled';
}

async function checkpoint(
  jobId: string,
  processed: number,
  successful: number,
  failed: number,
  lastUserId?: number,
): Promise<void> {
  await db.collectionJob.update({
    where: { id: jobId },
    data: {
      checkpoint: JSON.stringify({ processed, lastUserId, savedAt: new Date().toISOString() }),
      processedItems: processed,
      successItems: successful,
      failedItems: failed,
    },
  });
  logger.debug({ jobId, processed, lastUserId }, '💾 Checkpoint saved');
}

async function persistJobProgress(
  jobId: string,
  processed: number,
  successful: number,
  failed: number,
  percentage: number,
): Promise<void> {
  await db.collectionJob.update({
    where: { id: jobId },
    data: { processedItems: processed, successItems: successful, failedItems: failed, progress: percentage },
  });
}

async function persistDLQEntry(jobId: string, err: Error): Promise<void> {
  await db.dLQEntry.create({
    data: {
      jobId,
      queueName: QUEUE_NAMES.THUMBNAIL,
      payload: JSON.stringify({}),
      error: err.message,
      attempts: env.QUEUE_MAX_ATTEMPTS,
    },
  });
}
