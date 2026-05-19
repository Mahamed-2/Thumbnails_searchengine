// =============================================================================
// src/pipeline/resizer.ts — Image Resizer & Optimizer
// Resizes, converts, and compresses images using Sharp.
// =============================================================================

import sharp from 'sharp';
import { env } from '@config/env';

export interface ResizeOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
}

export interface ResizeResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  sizeKb: number;
}

export async function processImage(buffer: Buffer, options: ResizeOptions = {}): Promise<ResizeResult> {
  let instance = sharp(buffer);

  // Resize if dimensions are provided
  if (options.width || options.height) {
    instance = instance.resize({
      width: options.width,
      height: options.height,
      fit: 'cover',
      withoutEnlargement: true, // Don't upscale smaller images
    });
  }

  // Determine output format and quality
  const format = options.format || env.DEFAULT_OUTPUT_FORMAT;
  const quality = options.quality || env.DEFAULT_OUTPUT_QUALITY;

  switch (format) {
    case 'jpeg':
      instance = instance.jpeg({ quality, progressive: true });
      break;
    case 'webp':
      instance = instance.webp({ quality, lossless: false });
      break;
    case 'png':
      instance = instance.png({ compressionLevel: 9, adaptiveFiltering: true });
      break;
    default:
      instance = instance.toFormat(format);
  }

  const { data, info } = await instance.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    format: info.format,
    sizeKb: Math.round(info.size / 1024),
  };
}
