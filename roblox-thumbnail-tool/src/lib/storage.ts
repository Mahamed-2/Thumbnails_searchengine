// =============================================================================
// src/lib/storage.ts — Multi-provider image storage adapter
// Supports: 'local' (dev), 'supabase', 'vercel-blob'
// =============================================================================

import path from 'path';
import fs   from 'fs/promises';

export type StorageProvider = 'local' | 'supabase' | 'vercel-blob';

export interface UploadResult {
  provider:   StorageProvider;
  path:       string;  // internal path or blob key
  publicUrl:  string;  // CDN-accessible public URL
  sizeBytes?: number;
}

/** Detect which storage provider is configured. */
function getProvider(): StorageProvider {
  const env = process.env.STORAGE_PROVIDER;
  if (env === 'supabase')     return 'supabase';
  if (env === 'vercel-blob')  return 'vercel-blob';
  return 'local';
}

// ── Local File System ─────────────────────────────────────────────────────────

async function uploadLocal(buffer: Buffer, filename: string): Promise<UploadResult> {
  const imagesDir = process.env.IMAGES_DIR ?? './data/images';
  await fs.mkdir(imagesDir, { recursive: true });
  const filepath = path.join(imagesDir, filename);
  await fs.writeFile(filepath, buffer);
  return {
    provider:  'local',
    path:      filepath,
    publicUrl: `/images/${filename}`,
    sizeBytes: buffer.length,
  };
}

// ── Supabase Storage ──────────────────────────────────────────────────────────

async function uploadSupabase(buffer: Buffer, filename: string): Promise<UploadResult> {
  const url    = process.env.SUPABASE_URL;
  const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET ?? 'thumbnails';

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for Supabase storage');
  }

  const uploadUrl = `${url}/storage/v1/object/${bucket}/${filename}`;

  const res = await fetch(uploadUrl, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${key}`,
      'Content-Type': 'image/png',
      'x-upsert':     'true',
    },
    body: buffer as unknown as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase upload failed (${res.status}): ${text}`);
  }

  const publicUrl = `${url}/storage/v1/object/public/${bucket}/${filename}`;
  return { provider: 'supabase', path: `${bucket}/${filename}`, publicUrl, sizeBytes: buffer.length };
}

// ── Vercel Blob ───────────────────────────────────────────────────────────────

async function uploadVercelBlob(buffer: Buffer, filename: string): Promise<UploadResult> {
  // Lazy import so this module doesn't crash when @vercel/blob is not installed
  const { put } = await import('@vercel/blob');

  const blob = await put(filename, buffer, {
    access:          'public',
    contentType:     'image/png',
    addRandomSuffix: false,
  });

  return {
    provider:  'vercel-blob',
    path:      blob.pathname,
    publicUrl: blob.url,
    sizeBytes: buffer.length,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upload an image buffer to the configured storage provider.
 * @param buffer    Raw image bytes
 * @param filename  Desired filename (e.g. `user_123_420x420.png`)
 * @param provider  Override the configured provider (optional)
 */
export async function uploadImage(
  buffer:   Buffer,
  filename: string,
  provider?: StorageProvider,
): Promise<UploadResult> {
  const target = provider ?? getProvider();

  switch (target) {
    case 'supabase':    return uploadSupabase(buffer, filename);
    case 'vercel-blob': return uploadVercelBlob(buffer, filename);
    default:            return uploadLocal(buffer, filename);
  }
}

/**
 * Build a deterministic filename for a thumbnail.
 */
export function buildFilename(userId: number, size: string, cropType: string, format: string): string {
  return `users/${userId}/${cropType}_${size}.${format}`;
}
