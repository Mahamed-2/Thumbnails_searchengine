// =============================================================================
// src/types/index.ts — Shared TypeScript interfaces for the frontend
// =============================================================================

export interface Thumbnail {
  id: string;
  userId: number;
  imageUrl: string;
  localPath?: string | null;
  cloudUrl?: string | null;
  pHash?: string | null;
  size: string;
  format: string;
  cropType: string;
  fileSizeKb?: number | null;
  width?: number | null;
  height?: number | null;
  quality?: number | null;
  state: string;
  isDuplicate: boolean;
  jobId?: string | null;
  collectedAt: string;
  updatedAt: string;
}

export interface CollectionJob {
  id: string;
  name?: string | null;
  strategy: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  totalItems: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  _count?: {
    thumbnails: number;
    dlqEntries: number;
  };
}

export interface DashboardStats {
  thumbnails: {
    total: number;
    uniqueUsers: number;
    sizes: string[];
  };
  jobs: {
    byStatus: Record<string, number>;
  };
  recentActivity: Array<{
    id: string;
    name?: string | null;
    status: string;
    progress: number;
    processedItems: number;
    totalItems: number;
    updatedAt: string;
  }>;
  generatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export type CropType = 'avatar' | 'avatar-bust' | 'avatar-headshot';
export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type CollectionStrategy = 'user-range' | 'game-search' | 'popular-games';
export type JobStatus = CollectionJob['status'];
