// =============================================================================
// src/workers/dlqProcessor.ts — Dead-Letter Queue processor + replay
// Consumes DLQ entries, allows re-queuing failed jobs for retry.
// =============================================================================

import { Worker, type Job } from 'bullmq';
import { createRedisConnection } from '@queue/redis';
import { createLogger } from '@observability/logger';
import { db } from '@database/client';
import {
  QUEUE_NAMES,
  getThumbnailQueue,
  getExportQueue,
  enqueueThumbnailJob,
  enqueueExportJob,
} from '@queue/queues';
import {
  dlqReplayJobSchema,
  thumbnailJobSchema,
  exportJobSchema,
  type DLQReplayJobData,
} from '@queue/jobSchemas';

const logger = createLogger('dlq-processor');

export function createDLQProcessor(): Worker<DLQReplayJobData> {
  const worker = new Worker<DLQReplayJobData>(
    QUEUE_NAMES.DLQ,
    async (job) => processDLQEntry(job),
    {
      connection: createRedisConnection(),
      concurrency: 1, // Process DLQ entries one at a time
      autorun: false,  // Manual start — DLQ processor is not always running
    },
  );

  worker.on('active', (job) => {
    logger.info({ dlqEntryId: job.data.dlqEntryId, originalQueue: job.data.originalQueue }, '▶️  DLQ replay started');
  });

  worker.on('completed', (job) => {
    logger.info({ dlqEntryId: job.data.dlqEntryId }, '✅ DLQ entry replayed successfully');
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    logger.error({ dlqEntryId: job.data.dlqEntryId, error: err.message }, '❌ DLQ replay failed again');
  });

  logger.info('⚙️  DLQ processor initialized (manual start)');
  return worker;
}

// ── DLQ Entry Processor ────────────────────────────────────────────────────────
async function processDLQEntry(job: Job<DLQReplayJobData>): Promise<void> {
  const data = dlqReplayJobSchema.parse(job.data);
  const payload = JSON.parse(data.originalPayload) as unknown;

  logger.info({ dlqEntryId: data.dlqEntryId, queue: data.originalQueue, attempt: data.replayAttempt }, '🔄 Replaying DLQ entry');

  try {
    switch (data.originalQueue) {
      case QUEUE_NAMES.THUMBNAIL: {
        const jobData = thumbnailJobSchema.parse(payload);
        // Give it a fresh start — clear checkpoint so it starts from scratch
        // OR keep checkpoint to resume from where it failed
        await enqueueThumbnailJob({ ...jobData }, {});
        break;
      }

      case QUEUE_NAMES.EXPORT: {
        const jobData = exportJobSchema.parse(payload);
        await enqueueExportJob(jobData, {});
        break;
      }

      default:
        logger.warn({ queue: data.originalQueue }, '⚠️  Unknown queue in DLQ entry — skipping');
        return;
    }

    // Mark DLQ DB entry as resolved
    await db.dLQEntry.updateMany({
      where: { queueName: data.originalQueue, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });

    logger.info({ dlqEntryId: data.dlqEntryId }, '✅ DLQ entry resolved and re-queued');
  } catch (err) {
    logger.error({ dlqEntryId: data.dlqEntryId, err }, '❌ Could not re-queue DLQ entry');
    throw err;
  }
}

// ── Manual DLQ Management API ─────────────────────────────────────────────────
/**
 * List all unresolved DLQ entries from the database.
 */
export async function listDLQEntries(limit = 50) {
  return db.dLQEntry.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Resolve a DLQ entry without replaying it (manual dismiss).
 */
export async function resolveDLQEntry(dlqEntryId: string): Promise<void> {
  await db.dLQEntry.update({
    where: { id: dlqEntryId },
    data: { resolvedAt: new Date() },
  });
  logger.info({ dlqEntryId }, '✅ DLQ entry manually resolved');
}

/**
 * Gets queue stats for the DLQ.
 */
export async function getDLQStats() {
  const queue = getThumbnailQueue(); // Using thumbnail queue for stats example
  void queue; // Suppress unused warning

  const [dbEntries, bullCounts] = await Promise.all([
    db.dLQEntry.count({ where: { resolvedAt: null } }),
    (await import('@queue/queues')).getDLQQueue().getJobCounts(),
  ]);

  return {
    unresolvedDbEntries: dbEntries,
    bullmqCounts: bullCounts,
  };
}
