// =============================================================================
// src/lib/api-client.ts — Typed API client for the frontend
// =============================================================================

import type {
  CollectionJob,
  CropType,
  DashboardStats,
  ImageFormat,
  PaginatedResponse,
  Thumbnail,
} from '@/types';

const API_BASE = '/api';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Thumbnails ────────────────────────────────────────────────────────────────

export interface ThumbnailFilters {
  page?: number;
  limit?: number;
  size?: string;
  cropType?: CropType;
  userId?: number;
  format?: ImageFormat;
  isDuplicate?: boolean;
}

export async function fetchThumbnails(
  filters: ThumbnailFilters = {}
): Promise<PaginatedResponse<Thumbnail>> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.size) params.set('size', filters.size);
  if (filters.cropType) params.set('cropType', filters.cropType);
  if (filters.userId) params.set('userId', String(filters.userId));
  if (filters.format) params.set('format', filters.format);
  if (filters.isDuplicate !== undefined)
    params.set('isDuplicate', String(filters.isDuplicate));
  const qs = params.toString();
  return request(`/thumbnails${qs ? `?${qs}` : ''}`);
}

export async function deleteThumbnail(id: string): Promise<{ message: string }> {
  return request(`/thumbnails/${id}`, { method: 'DELETE' });
}

// ── Collections ───────────────────────────────────────────────────────────────

export interface CreateUserRangeJob {
  strategy: 'user-range';
  name?: string;
  startUserId: number;
  endUserId: number;
  batchSize?: number;
  sizes?: string[];
  cropTypes?: CropType[];
  format?: ImageFormat;
  downloadImages?: boolean;
}

export interface CreateGameSearchJob {
  strategy: 'game-search';
  name?: string;
  keyword: string;
  limit?: number;
  sizes?: string[];
  downloadImages?: boolean;
}

export interface CreatePopularGamesJob {
  strategy: 'popular-games';
  name?: string;
  limit?: number;
  sizes?: string[];
  downloadImages?: boolean;
}

export type CreateJobPayload =
  | CreateUserRangeJob
  | CreateGameSearchJob
  | CreatePopularGamesJob;

export async function fetchCollections(
  status?: string,
  limit = 50
): Promise<CollectionJob[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set('status', status);
  return request(`/collections?${params.toString()}`);
}

export async function fetchCollectionJob(id: string): Promise<CollectionJob> {
  return request(`/collections/${id}/status`);
}

export async function createCollectionJob(
  payload: CreateJobPayload
): Promise<{ message: string; job: CollectionJob }> {
  return request('/collections', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cancelCollectionJob(
  id: string
): Promise<{ message: string }> {
  return request(`/collections/${id}/cancel`, { method: 'POST' });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return request('/analytics/dashboard');
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function requestExport(payload: {
  name?: string;
  format: 'json' | 'csv';
  filters?: Record<string, string>;
}): Promise<{ message: string; exportId: string; estimatedReady: string }> {
  return request('/export', { method: 'POST', body: JSON.stringify(payload) });
}
