// =============================================================================
// src/workers/exportWorker.ts — Dataset export worker (JSON / CSV)
// Streams DB records to file, supports filters, marks export ready when done.
// =============================================================================

import { Worker, type Job } from 'bullmq';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { createRedisConnection } from '@queue/redis';
import { createLogger } from '@observability/logger';
import { env } from '@config/env';
import { db } from '@database/client';
import type { Prisma } from '@prisma/client';
import { QUEUE_NAMES } from '@queue/queues';
import { exportJobSchema, JOB_NAMES, type ExportJobData } from '@queue/jobSchemas';
import { queueJobsTotal } from '@observability/metrics';

const logger = createLogger('export-worker');

const BATCH_SIZE = 1000; // Stream in batches to avoid OOM

export function createExportWorker(): Worker<ExportJobData> {
  const worker = new Worker<ExportJobData>(
    QUEUE_NAMES.EXPORT,
    async (job) => processExportJob(job),
    {
      connection: createRedisConnection(),
      concurrency: 2, // Limit to 2 concurrent exports
    },
  );

  worker.on('active', (job) => {
    logger.info({ exportId: job.data.exportId }, '▶️  Export job started');
  });

  worker.on('completed', (job) => {
    queueJobsTotal.inc({ queue: QUEUE_NAMES.EXPORT, status: 'completed' });
    logger.info({ exportId: job.data.exportId }, '✅ Export job completed');
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    queueJobsTotal.inc({ queue: QUEUE_NAMES.EXPORT, status: 'failed' });
    logger.error({ exportId: job.data.exportId, error: err.message }, '❌ Export job failed');
  });

  logger.info('⚙️  Export worker started');
  return worker;
}

// ── Job Processor ──────────────────────────────────────────────────────────────
async function processExportJob(job: Job<ExportJobData>): Promise<void> {
  const data = exportJobSchema.parse(job.data);

  // Build DB filter from job config
  const where: import('@prisma/client').Prisma.ThumbnailWhereInput = buildWhereClause(data.filters);

  // Count total records
  const total = await db.thumbnail.count({ where });
  logger.info({ exportId: data.exportId, format: data.format, total }, '📦 Starting export');

  // Prepare output directory
  const exportDir = join(env.DATA_DIR, 'exports');
  await mkdir(exportDir, { recursive: true });
  const filename = `export-${data.exportId}.${data.format === 'zip' ? 'zip' : data.format}`;
  const outputPath = join(exportDir, filename);

  try {
    switch (data.format) {
      case 'json':
        await exportJson(outputPath, where, total, job);
        break;
      case 'csv':
        await exportCsv(outputPath, where, total, job);
        break;
      case 'zip':
        // ZIP with images is Phase 5+ (requires storage adapter)
        await exportJson(outputPath.replace('.zip', '.json'), where, total, job);
        break;
    }

    // Get file size
    const { statSync } = await import('fs');
    const stats = statSync(outputPath.endsWith('.zip') ? outputPath.replace('.zip', '.json') : outputPath);

    // Mark export as ready in DB
    await db.datasetExport.update({
      where: { id: data.exportId },
      data: {
        status: 'ready',
        filePath: outputPath,
        fileSizeKb: Math.round(stats.size / 1024),
        recordCount: total,
      },
    });

    logger.info({ exportId: data.exportId, outputPath, total }, '✅ Export ready');
  } catch (err) {
    await db.datasetExport.update({
      where: { id: data.exportId },
      data: { status: 'expired' }, // Reuse 'expired' for failed state
    });
    throw err;
  }
}

// ── JSON Export ────────────────────────────────────────────────────────────────
async function exportJson(
  outputPath: string,
  where: Prisma.ThumbnailWhereInput,
  total: number,
  job: Job<ExportJobData>,
): Promise<void> {
  const stream = createWriteStream(outputPath, { encoding: 'utf8' });
  stream.write('[\n');

  let offset = 0;
  let first = true;

  while (offset < total) {
    const records = await db.thumbnail.findMany({
      where,
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { collectedAt: 'asc' },
      select: {
        id: true, userId: true, imageUrl: true, cloudUrl: true,
        size: true, format: true, cropType: true, state: true,
        width: true, height: true, fileSizeKb: true, pHash: true,
        isDuplicate: true, collectedAt: true,
      },
    });

    for (const record of records) {
      if (!first) stream.write(',\n');
      stream.write(JSON.stringify(record));
      first = false;
    }

    offset += BATCH_SIZE;
    const percentage = Math.min(Math.round((offset / total) * 100), 100);
    await job.updateProgress(percentage);
  }

  stream.write('\n]');
  await new Promise<void>((resolve, reject) => {
    stream.end(resolve);
    stream.on('error', reject);
  });
}

// ── CSV Export ─────────────────────────────────────────────────────────────────
async function exportCsv(
  outputPath: string,
  where: Prisma.ThumbnailWhereInput,
  total: number,
  job: Job<ExportJobData>,
): Promise<void> {
  const stream = createWriteStream(outputPath, { encoding: 'utf8' });

  // Header row
  const headers = ['id', 'userId', 'imageUrl', 'cloudUrl', 'size', 'format', 'cropType',
    'state', 'width', 'height', 'fileSizeKb', 'pHash', 'isDuplicate', 'collectedAt'];
  stream.write(headers.join(',') + '\n');

  let offset = 0;

  while (offset < total) {
    const records = await db.thumbnail.findMany({
      where,
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { collectedAt: 'asc' },
    });

    for (const r of records) {
      const row = [
        r.id, r.userId, csvEscape(r.imageUrl), csvEscape(r.cloudUrl ?? ''),
        r.size, r.format, r.cropType, r.state,
        r.width ?? '', r.height ?? '', r.fileSizeKb ?? '',
        csvEscape(r.pHash ?? ''), r.isDuplicate, r.collectedAt.toISOString(),
      ].join(',');
      stream.write(row + '\n');
    }

    offset += BATCH_SIZE;
    await job.updateProgress(Math.min(Math.round((offset / total) * 100), 100));
  }

  await new Promise<void>((resolve, reject) => {
    stream.end(resolve);
    stream.on('error', reject);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildWhereClause(
  filters: ExportJobData['filters'],
): Prisma.ThumbnailWhereInput {
  return {
    ...(filters.size && { size: filters.size }),
    ...(filters.cropType && { cropType: filters.cropType }),
    ...(filters.format && { format: filters.format }),
    ...(filters.isDuplicate !== undefined && { isDuplicate: filters.isDuplicate }),
    ...(filters.fromDate || filters.toDate
      ? {
          collectedAt: {
            ...(filters.fromDate && { gte: new Date(filters.fromDate) }),
            ...(filters.toDate && { lte: new Date(filters.toDate) }),
          },
        }
      : {}),
  };
}
