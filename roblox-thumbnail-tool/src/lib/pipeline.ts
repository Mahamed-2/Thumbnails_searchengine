import sharp from 'sharp';

import { db } from '@/lib/db';
import { buildFilename, uploadImage } from '@/lib/storage';

export interface PipelineOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  userId?: number;
}

export interface ResizeResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  sizeKb: number;
}

export interface PipelineResult {
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  pHash?: string;
  isDuplicate?: boolean;
  image?: ResizeResult;
  cloudUrl?: string;
  localPath?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  metadata?: sharp.Metadata;
}

/**
 * Downloads image buffer from the Roblox CDN with automatic retry and timeouts.
 */
export async function downloadImage(url: string, attempts = 3): Promise<Buffer> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        throw new Error(`Roblox CDN returned HTTP status ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      if (attempt === attempts) {
        throw new Error(`Failed to download image from ${url} after ${attempts} attempts: ${err instanceof Error ? err.message : String(err)}`);
      }
      // Linear backoff
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(`Failed to download image from ${url}`);
}

/**
 * Validates dimensions, format, and structure of the image buffer using sharp.
 */
export async function validateImage(buffer: Buffer): Promise<ValidationResult> {
  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata.format) {
      return { isValid: false, error: 'Unknown image format' };
    }

    const minWidth = Number(process.env.MIN_IMAGE_WIDTH ?? '10');
    const minHeight = Number(process.env.MIN_IMAGE_HEIGHT ?? '10');

    if (metadata.width && metadata.width < minWidth) {
      return { isValid: false, error: `Image width ${metadata.width}px is below minimum limit ${minWidth}px` };
    }

    if (metadata.height && metadata.height < minHeight) {
      return { isValid: false, error: `Image height ${metadata.height}px is below minimum limit ${minHeight}px` };
    }

    return { isValid: true, metadata };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Failed to parse image structure',
    };
  }
}

/**
 * Resizes, formats, and compresses the image using sharp.
 */
export async function processImage(buffer: Buffer, options: PipelineOptions = {}): Promise<ResizeResult> {
  let instance = sharp(buffer);

  if (options.width || options.height) {
    instance = instance.resize({
      width: options.width,
      height: options.height,
      fit: 'cover',
      withoutEnlargement: true,
    });
  }

  const format = options.format ?? 'png';
  const quality = options.quality ?? 80;

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

/**
 * Calculates a perceptual hash (pHash) of an image buffer using a native Average Hash (aHash) algorithm.
 * Resizes the image to a 16x16 grid, converts it to grayscale, computes average luminance,
 * and yields a 256-bit (64 hex character) signature.
 */
export async function calculatePHash(buffer: Buffer): Promise<string> {
  const raw = await sharp(buffer)
    .resize(16, 16, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  let sum = 0;
  for (let i = 0; i < raw.length; i++) {
    sum += raw[i];
  }
  const average = sum / raw.length;

  let binary = '';
  for (let i = 0; i < raw.length; i++) {
    binary += raw[i] >= average ? '1' : '0';
  }

  let hex = '';
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.slice(i, i + 4);
    hex += parseInt(chunk, 2).toString(16);
  }

  return hex;
}

/**
 * Calculates Hamming distance between two hex hashes.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be of the same length');
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const n1 = parseInt(hash1[i] as string, 16);
    const n2 = parseInt(hash2[i] as string, 16);
    let val = n1 ^ n2;
    while (val > 0) {
      distance += val & 1;
      val >>= 1;
    }
  }

  return distance;
}

/**
 * Returns true if two hashes are duplicate (similarity matches or exceeds threshold).
 */
export function isDuplicate(hash1: string, hash2: string): boolean {
  const maxDistance = hash1.length * 4; // 4 bits per hex character
  const distance = hammingDistance(hash1, hash2);
  const similarity = ((maxDistance - distance) / maxDistance) * 100;
  const threshold = Number(process.env.PHASH_SIMILARITY_THRESHOLD ?? '90');
  return similarity >= threshold;
}

/**
 * Executes the complete pipeline orchestrator for a given image URL.
 */
export async function runPipeline(url: string, options: PipelineOptions = {}): Promise<PipelineResult> {
  try {
    // 1. Download
    const rawBuffer = await downloadImage(url);

    // 2. Validate
    const validation = await validateImage(rawBuffer);
    if (!validation.isValid) {
      return {
        status: 'error',
        reason: validation.error,
      };
    }

    // 3. Process
    const processed = await processImage(rawBuffer, options);

    // 3.5 Upload to storage (if downloadImages is enabled)
    let cloudUrl: string | undefined;
    let localPath: string | undefined;

    if (process.env.DISABLE_STORAGE_UPLOAD !== 'true' && options.userId && options.format) {
      try {
        const filename = buildFilename(
          options.userId,
          options.width && options.height ? `${options.width}x${options.height}` : 'original',
          'avatar',
          options.format,
        );
        const uploadResult = await uploadImage(processed.buffer, filename);
        cloudUrl  = uploadResult.publicUrl;
        localPath = uploadResult.path;
      } catch (err) {
        // Storage upload failure is non-fatal — log and continue
        console.warn('[pipeline] Storage upload failed:', err instanceof Error ? err.message : String(err));
      }
    }

    // 4. Perceptual hashing and deduplication checks
    let pHash: string | undefined;
    let isDupe = false;

    if (process.env.ENABLE_DEDUPLICATION !== 'false') {
      pHash = await calculatePHash(processed.buffer);

      if (options.userId) {
        const existing = await db.thumbnail.findFirst({
          where: { userId: options.userId, pHash },
          select: { id: true },
        });

        if (existing) {
          isDupe = true;
        }
      }
    }

    return {
      status: 'success',
      pHash,
      isDuplicate: isDupe,
      image: processed,
      cloudUrl,
      localPath,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      reason: errorMsg,
    };
  }
}
