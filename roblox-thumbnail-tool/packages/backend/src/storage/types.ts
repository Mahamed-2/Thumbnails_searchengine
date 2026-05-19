// =============================================================================
// src/storage/types.ts — Storage Adapter Interface
// =============================================================================

export interface SaveResult {
  localPath?: string;
  cloudUrl?: string;
}

export interface StorageAdapter {
  save(buffer: Buffer, path: string): Promise<SaveResult>;
  delete(path: string): Promise<void>;
}
