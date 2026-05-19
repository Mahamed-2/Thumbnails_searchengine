// =============================================================================
// src/queue/jobSchemas.ts — Zod schemas + TypeScript types for all BullMQ jobs
// Single source of truth: validated at enqueue time AND inside the worker.
// =============================================================================

import { z } from 'zod';

// ── Shared sub-schemas ─────────────────────────────────────────────────────────
const cropTypesSchema = z.array(
  z.enum(['avatar', 'avatar-bust', 'avatar-headshot']),
).min(1).default(['avatar']);

const sizesSchema = z.array(z.string().regex(/^\d+x\d+$/)).min(1).default(['420x420']);

const formatSchema = z.enum(['png', 'jpeg', 'webp']).default('png');

// ── User-Range Collection Job ──────────────────────────────────────────────────
export const userRangeJobSchema = z.object({
  jobId: z.string().cuid(),
  strategy: z.literal('user-range'),
  startUserId: z.number().int().positive(),
  endUserId: z.number().int().positive(),
  batchSize: z.number().int().min(1).max(100).default(100),
  sizes: sizesSchema,
  cropTypes: cropTypesSchema,
  format: formatSchema,
  downloadImages: z.boolean().default(true),
  // Checkpointing: last processed userId (for resume)
  checkpoint: z.number().int().positive().optional(),
});
export type UserRangeJobData = z.infer<typeof userRangeJobSchema>;

// ── Game-Search Collection Job ─────────────────────────────────────────────────
export const gameSearchJobSchema = z.object({
  jobId: z.string().cuid(),
  strategy: z.literal('game-search'),
  keyword: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(1000).default(100),
  sizes: sizesSchema,
  downloadImages: z.boolean().default(true),
});
export type GameSearchJobData = z.infer<typeof gameSearchJobSchema>;

// ── Popular-Games Collection Job ───────────────────────────────────────────────
export const popularGamesJobSchema = z.object({
  jobId: z.string().cuid(),
  strategy: z.literal('popular-games'),
  limit: z.number().int().min(1).max(1000).default(100),
  sizes: sizesSchema,
  downloadImages: z.boolean().default(true),
});
export type PopularGamesJobData = z.infer<typeof popularGamesJobSchema>;

// ── Union of all collection job types ─────────────────────────────────────────
export const thumbnailJobSchema = z.discriminatedUnion('strategy', [
  userRangeJobSchema,
  gameSearchJobSchema,
  popularGamesJobSchema,
]);
export type ThumbnailJobData = z.infer<typeof thumbnailJobSchema>;

// ── Export Job ─────────────────────────────────────────────────────────────────
export const exportJobSchema = z.object({
  exportId: z.string().cuid(),
  format: z.enum(['json', 'csv', 'zip']),
  filters: z.object({
    size: z.string().optional(),
    cropType: z.string().optional(),
    format: z.string().optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    isDuplicate: z.boolean().optional(),
  }).default({}),
  outputPath: z.string().optional(),
});
export type ExportJobData = z.infer<typeof exportJobSchema>;

// ── DLQ Replay Job ────────────────────────────────────────────────────────────
export const dlqReplayJobSchema = z.object({
  dlqEntryId: z.string().cuid(),
  originalQueue: z.string(),
  originalPayload: z.string(), // JSON string of original job data
  replayAttempt: z.number().int().min(1).default(1),
});
export type DLQReplayJobData = z.infer<typeof dlqReplayJobSchema>;

// ── Job name constants (avoids magic strings) ─────────────────────────────────
export const JOB_NAMES = {
  THUMBNAIL_COLLECTION: 'thumbnail:collect',
  DATASET_EXPORT: 'dataset:export',
  DLQ_REPLAY: 'dlq:replay',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// ── Progress shape (stored in BullMQ job progress) ────────────────────────────
export interface JobProgress {
  processed: number;
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  percentage: number;
  currentBatch?: number;
  lastProcessedId?: number;
  estimatedRemainingMs?: number;
  phase: 'initializing' | 'collecting' | 'processing' | 'storing' | 'complete';
}
