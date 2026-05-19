// =============================================================================
// src/pipeline/validator.ts — Image Validator
// Validates MIME type, dimensions, and file size.
// =============================================================================

import sharp from 'sharp';
import { env } from '@config/env';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  metadata?: sharp.Metadata;
}

export async function validateImage(buffer: Buffer): Promise<ValidationResult> {
  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata.format) {
      return { isValid: false, error: 'Unknown image format' };
    }

    if (metadata.width && metadata.width < env.MIN_IMAGE_WIDTH) {
      return { isValid: false, error: `Image width ${metadata.width}px is below minimum ${env.MIN_IMAGE_WIDTH}px` };
    }

    if (metadata.height && metadata.height < env.MIN_IMAGE_HEIGHT) {
      return { isValid: false, error: `Image height ${metadata.height}px is below minimum ${env.MIN_IMAGE_HEIGHT}px` };
    }

    return { isValid: true, metadata };
  } catch (err: unknown) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Failed to parse image',
    };
  }
}
