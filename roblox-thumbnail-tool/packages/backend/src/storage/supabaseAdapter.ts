// =============================================================================
// src/storage/supabaseAdapter.ts — Supabase Storage Adapter
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { env } from '@config/env';
import type { StorageAdapter, SaveResult } from './types';

export class SupabaseAdapter implements StorageAdapter {
  private client: ReturnType<typeof createClient>;

  constructor() {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials missing');
    }
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }

  async save(buffer: Buffer, relativePath: string): Promise<SaveResult> {
    const { data, error } = await this.client
      .storage
      .from(env.SUPABASE_BUCKET)
      .upload(relativePath, buffer, {
        contentType: 'image/png', // Assumes PNG, but could be dynamic
        upsert: true,
      });

    if (error) throw new Error(`Supabase upload error: ${error.message}`);

    const { data: publicUrlData } = this.client
      .storage
      .from(env.SUPABASE_BUCKET)
      .getPublicUrl(relativePath);

    return { cloudUrl: publicUrlData.publicUrl };
  }

  async delete(relativePath: string): Promise<void> {
    const { error } = await this.client
      .storage
      .from(env.SUPABASE_BUCKET)
      .remove([relativePath]);

    if (error) throw new Error(`Supabase delete error: ${error.message}`);
  }
}
