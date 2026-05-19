// =============================================================================
// src/storage/cloudinaryAdapter.ts — Cloudinary Adapter
// =============================================================================

import { v2 as cloudinary } from 'cloudinary';
import { env } from '@config/env';
import type { StorageAdapter, SaveResult } from './types';

export class CloudinaryAdapter implements StorageAdapter {
  constructor() {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary credentials missing');
    }
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
  }

  async save(buffer: Buffer, relativePath: string): Promise<SaveResult> {
    return new Promise((resolve, reject) => {
      // Remove file extension for Cloudinary public_id
      const publicId = relativePath.replace(/\.[^/.]+$/, '');
      
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, overwrite: true },
        (error, result) => {
          if (error) return reject(new Error(`Cloudinary upload error: ${error.message}`));
          if (!result) return reject(new Error('Cloudinary returned no result'));
          
          resolve({ cloudUrl: result.secure_url });
        }
      );
      
      stream.end(buffer);
    });
  }

  async delete(relativePath: string): Promise<void> {
    const publicId = relativePath.replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  }
}
