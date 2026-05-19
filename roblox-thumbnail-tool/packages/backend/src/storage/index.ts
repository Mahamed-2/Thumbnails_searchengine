// =============================================================================
// src/storage/index.ts — Storage Adapter Factory
// =============================================================================

import { env } from '@config/env';
import type { StorageAdapter } from './types';
import { LocalAdapter } from './localAdapter';
import { SupabaseAdapter } from './supabaseAdapter';
import { CloudinaryAdapter } from './cloudinaryAdapter';

let storageInstance: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (storageInstance) return storageInstance;

  switch (env.STORAGE_PROVIDER) {
    case 'supabase':
      storageInstance = new SupabaseAdapter();
      break;
    case 'cloudinary':
      storageInstance = new CloudinaryAdapter();
      break;
    case 'local':
    default:
      storageInstance = new LocalAdapter();
      break;
  }

  return storageInstance;
}
