// =============================================================================
// src/queue/queues.ts — BullMQ Queue definitions + Flow Producer
// All queues are lazily initialized singletons to avoid re-connection issues.
// =============================================================================

import { Queue, FlowProducer, type JobsOptions } from 'bullmq';
import { createRedisConnection } from '@queue/redis';
import { createLogger } from '@observability/logger';
import { env } from '@config/env';
import {
  type ThumbnailJobData,
  type ExportJobData,
  type DLQReplayJobData,
  JOB_NAMES,
} from '@queue/jobSchemas';

const logger = createLogger('queues');

// ── Default Job Options ────────────────────────────────────────────────────────
const defaultJobOptions: JobsOptions = {
  attempts: env.QUEUE_MAX_ATTEMPTS,
  backoff: {
    type: 'exponential',
    delay: env.QUEUE_BACKOFF_DELAY_MS,
  },
  removeOnComplete: { count: env.QUEUE_REMOVE_ON_COMPLETE },
  removeOnFail: { count: 100 }, // Keep last 100 failed for inspection
};

// ── Queue Names ────────────────────────────────────────────────────────────────
export const QUEUE_NAMES = {
  THUMBNAIL: 'thumbnail-collection',
  EXPORT: 'dataset-export',
  DLQ: env.DLQ_NAME,
} as const;

// ── Singleton Queue Instances ──────────────────────────────────────────────────
let thumbnailQueue: Queue<ThumbnailJobData> | null = null;
let exportQueue: Queue<ExportJobData> | null = null;
let dlqQueue: Queue<DLQReplayJobData> | null = null;
let flowProducer: FlowProducer | null = null;

export function getThumbnailQueue(): Queue<ThumbnailJobData> {
  if (!thumbnailQueue) {
    thumbnailQueue = new Queue<ThumbnailJobData>(QUEUE_NAMES.THUMBNAIL, {
      connection: createRedisConnection(),
      defaultJobOptions,
    });
    logger.info({ queue: QUEUE_NAMES.THUMBNAIL }, '📬 Thumbnail queue initialized');
  }
  return thumbnailQueue;
}

export function getExportQueue(): Queue<ExportJobData> {
  if (!exportQueue) {
    exportQueue = new Queue<ExportJobData>(QUEUE_NAMES.EXPORT, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 2,
        removeOnComplete: { count: 20 },
      },
    });
    logger.info({ queue: QUEUE_NAMES.EXPORT }, '📬 Export queue initialized');
  }
  return exportQueue;
}

export function getDLQQueue(): Queue<DLQReplayJobData> {
  if (!dlqQueue) {
    dlqQueue = new Queue<DLQReplayJobData>(QUEUE_NAMES.DLQ, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 1,           // DLQ retries are manual — no auto-retry
        removeOnComplete: { count: 50 },
        removeOnFail: false,   // Keep ALL failed DLQ entries
      },
    });
    logger.info({ queue: QUEUE_NAMES.DLQ }, '📬 DLQ initialized');
  }
  return dlqQueue;
}

export function getFlowProducer(): FlowProducer {
  if (!flowProducer) {
    flowProducer = new FlowProducer({
      connection: createRedisConnection(),
    });
  }
  return flowProducer;
}

// ── Enqueue Helpers ────────────────────────────────────────────────────────────

/**
 * Enqueue a thumbnail collection job.
 * Uses jobId as the BullMQ job ID for idempotency (duplicate jobs are skipped).
 */
export async function enqueueThumbnailJob(
  data: ThumbnailJobData,
  opts: Partial<JobsOptions> = {},
): Promise<string> {
  const queue = getThumbnailQueue();

  const job = await queue.add(JOB_NAMES.THUMBNAIL_COLLECTION, data, {
    ...opts,
    jobId: `thumbnail:${data.jobId}`, // Idempotent: same jobId = skip if already queued
  });

  logger.info(
    { jobId: data.jobId, bullJobId: job.id, strategy: data.strategy },
    '📨 Thumbnail job enqueued',
  );

  return job.id ?? data.jobId;
}

/**
 * Enqueue a dataset export job.
 */
export async function enqueueExportJob(
  data: ExportJobData,
  opts: Partial<JobsOptions> = {},
): Promise<string> {
  const queue = getExportQueue();

  const job = await queue.add(JOB_NAMES.DATASET_EXPORT, data, {
    ...opts,
    jobId: `export:${data.exportId}`,
  });

  logger.info({ exportId: data.exportId, bullJobId: job.id }, '📨 Export job enqueued');
  return job.id ?? data.exportId;
}

/**
 * Send a failed job to the Dead-Letter Queue for later inspection + replay.
 */
export async function sendToDLQ(
  originalQueue: string,
  originalPayload: unknown,
  error: Error,
): Promise<void> {
  const queue = getDLQQueue();
  const payload = JSON.stringify(originalPayload);

  await queue.add(
    JOB_NAMES.DLQ_REPLAY,
    {
      dlqEntryId: `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      originalQueue,
      originalPayload: payload,
      replayAttempt: 1,
    },
    {}, // Let BullMQ generate unique IDs for DLQ entries
  );

  logger.warn(
    { queue: originalQueue, error: error.message },
    '🪣 Job sent to DLQ',
  );
}

/**
 * Gracefully close all queues (called during shutdown).
 */
export async function closeAllQueues(): Promise<void> {
  const queues = [thumbnailQueue, exportQueue, dlqQueue].filter(Boolean);
  await Promise.allSettled(queues.map((q) => q!.close()));
  await flowProducer?.close();
  logger.info('📭 All queues closed');
}

/**
 * Get combined stats for monitoring dashboard.
 */
export async function getQueueStats() {
  const [thumbCounts, exportCounts, dlqCounts] = await Promise.all([
    getThumbnailQueue().getJobCounts(),
    getExportQueue().getJobCounts(),
    getDLQQueue().getJobCounts(),
  ]);

  return {
    thumbnail: thumbCounts,
    export: exportCounts,
    dlq: dlqCounts,
  };
}
