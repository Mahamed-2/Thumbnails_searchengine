// =============================================================================
// src/storage/localAdapter.ts — Local Filesystem Storage
// =============================================================================

import { writeFile, unlink, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { env } from '@config/env';
import type { StorageAdapter, SaveResult } from './types';

export class LocalAdapter implements StorageAdapter {
  async save(buffer: Buffer, relativePath: string): Promise<SaveResult> {
    const fullPath = join(env.IMAGES_DIR, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    return { localPath: fullPath };
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = join(env.IMAGES_DIR, relativePath);
    try {
      await unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}
