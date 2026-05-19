// =============================================================================
// src/pipeline/pipeline.ts — Main Image Processing Pipeline Orchestrator
// Coordinates download, validation, hashing, resizing, and deduplication.
// =============================================================================

import { downloadImage } from './downloader';
import { validateImage } from './validator';
import { calculatePHash } from './hasher';
import { processImage, type ResizeResult } from './resizer';
import { env } from '@config/env';
import { db } from '@database/client';
import { createLogger } from '@observability/logger';

const logger = createLogger('pipeline');

export interface PipelineOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp';
  userId?: number;
}

export interface PipelineResult {
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  pHash?: string;
  isDuplicate?: boolean;
  image?: ResizeResult;
}

export async function runPipeline(url: string, options: PipelineOptions = {}): Promise<PipelineResult> {
  try {
    // 1. Download
    const rawBuffer = await downloadImage(url);

    // 2. Validate
    const validation = await validateImage(rawBuffer);
    if (!validation.isValid) {
      return {
        status: 'error',
        ...(validation.error ? { reason: validation.error } : {}),
      };
    }

    // 3. Process/Resize
    const processed = await processImage(rawBuffer, options);

    // 4. Calculate Hash
    let pHash: string | undefined;
    let isDuplicate = false;

    if (env.ENABLE_DEDUPLICATION) {
      pHash = await calculatePHash(processed.buffer);
      
      // If we know the user, we can do a quick check against their other thumbnails
      if (options.userId) {
        const existing = await db.thumbnail.findFirst({
          where: { userId: options.userId, pHash },
          select: { id: true }
        });
        
        if (existing) {
          isDuplicate = true;
          logger.debug({ url, userId: options.userId, pHash }, '🔗 Duplicate image detected');
        }
      }
    }

    return {
      status: 'success',
      ...(pHash ? { pHash } : {}),
      isDuplicate,
      image: processed,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ url, error: errorMsg }, '❌ Pipeline error');
    return { status: 'error', reason: errorMsg };
  }
}
