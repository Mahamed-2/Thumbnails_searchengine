// =============================================================================
// src/types/api.ts — Shared internal API types
// =============================================================================

// ── Pagination ─────────────────────────────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ── Error Shapes ───────────────────────────────────────────────────────────────
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}

// ── Collection Job Config ──────────────────────────────────────────────────────
export interface UserRangeCollectionConfig {
  strategy: 'user-range';
  startUserId: number;
  endUserId: number;
  batchSize: number;
  sizes: string[];
  cropTypes: string[];
  format: string;
  downloadImages: boolean;
}

export interface GameSearchCollectionConfig {
  strategy: 'game-search';
  keyword: string;
  limit: number;
  sizes: string[];
  downloadImages: boolean;
}

export interface PopularGamesCollectionConfig {
  strategy: 'popular-games';
  limit: number;
  sizes: string[];
  downloadImages: boolean;
}

export type CollectionConfig =
  | UserRangeCollectionConfig
  | GameSearchCollectionConfig
  | PopularGamesCollectionConfig;

// ── Job Data (passed to BullMQ) ────────────────────────────────────────────────
export interface ThumbnailJobData {
  jobId: string;
  config: CollectionConfig;
}

// ── Search Results (fallback APIs) ────────────────────────────────────────────
export interface SearchImageResult {
  url: string;
  thumbnailUrl?: string;
  name?: string;
  width?: number;
  height?: number;
  format?: string;
  source: 'bing' | 'duckduckgo';
}

// ── Circuit Breaker State ──────────────────────────────────────────────────────
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  requests: number;
  fallbacks: number;
}

// ── Cache Entry ────────────────────────────────────────────────────────────────
export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}
