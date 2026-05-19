// =============================================================================
// src/workers/index.ts — Worker bootstrap (replaces Phase 1 stub)
// Starts all workers with graceful shutdown + health monitoring.
// =============================================================================

import { createLogger } from '@observability/logger';
import { createThumbnailWorker } from '@workers/thumbnailWorker';
import { createExportWorker } from '@workers/exportWorker';
import { createDLQProcessor } from '@workers/dlqProcessor';
import { closeAllQueues } from '@queue/queues';
import type { Worker } from 'bullmq';

const logger = createLogger('worker-manager');

let workers: Worker[] = [];
let isShuttingDown = false;

// ── Start All Workers ──────────────────────────────────────────────────────────
export function startWorkers(): void {
  if (workers.length > 0) {
    logger.warn('Workers already started — skipping');
    return;
  }

  logger.info('🚀 Starting all workers...');

  const thumbnailWorker = createThumbnailWorker();
  const exportWorker = createExportWorker();
  const dlqProcessor = createDLQProcessor();

  workers = [thumbnailWorker, exportWorker, dlqProcessor];

  logger.info(
    { count: workers.length, types: ['thumbnail', 'export', 'dlq'] },
    '✅ All workers started',
  );
}

// ── Graceful Shutdown ──────────────────────────────────────────────────────────
export async function stopWorkers(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('🛑 Stopping workers...');

  // Close each worker gracefully — waits for active jobs to finish
  await Promise.allSettled(
    workers.map(async (w) => {
      try {
        await w.close();
        logger.info({ name: w.name }, '✅ Worker closed');
      } catch (err) {
        logger.error({ err, name: w.name }, '❌ Error closing worker');
      }
    }),
  );

  await closeAllQueues();
  workers = [];
  isShuttingDown = false;

  logger.info('✅ All workers stopped');
}

// ── Health Check ───────────────────────────────────────────────────────────────
export function getWorkerHealth(): Array<{ name: string; running: boolean }> {
  return workers.map((w) => ({
    name: w.name,
    running: !w.closing,
  }));
}
