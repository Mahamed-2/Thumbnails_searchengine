// =============================================================================
// src/api/httpClient.ts — Shared axios instance with retry, timeout & logging
// =============================================================================

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import axiosRetry from 'axios-retry';
import { createLogger } from '@observability/logger';
import { robloxApiRequests, robloxApiRateLimitHits } from '@observability/metrics';

const logger = createLogger('http-client');

export interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
  userAgent?: string;
  label?: string; // for logging/metrics
}

/**
 * Creates a pre-configured axios instance with:
 * - Timeout (30s default)
 * - User-Agent header
 * - Automatic retry on 5xx / network errors (exponential backoff + jitter)
 * - Request/response interceptors for logging and metrics
 */
export function createHttpClient(config: HttpClientConfig): AxiosInstance {
  const { baseURL, timeout = 30_000, userAgent = 'RobloxDatasetTool/1.0', label = 'http' } = config;

  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  // ── Retry Configuration ──────────────────────────────────────────────────────
  axiosRetry(client, {
    retries: 3,
    retryDelay: (retryCount, error) => {
      // Exponential backoff with ±20% jitter
      const base = Math.min(1000 * Math.pow(2, retryCount - 1), 10_000);
      const jitter = base * 0.2 * (Math.random() * 2 - 1);
      const delay = Math.round(base + jitter);

      logger.warn(
        { retryCount, delay, status: error.response?.status, url: error.config?.url, label },
        `⚠️  Retrying request (attempt ${retryCount})`,
      );
      return delay;
    },
    retryCondition: (error) => {
      // Retry on network errors, 429, and 5xx — but NOT 4xx except 429
      const status = error.response?.status;
      const isNetworkError = axiosRetry.isNetworkError(error);
      const isRetryableStatus = status !== undefined && (status === 429 || status >= 500);
      return isNetworkError || isRetryableStatus;
    },
    onRetry: (retryCount, error, config) => {
      logger.warn(
        { retryCount, url: config.url, status: error.response?.status, label },
        `🔄 Retry ${retryCount} for ${config.url ?? 'unknown'}`,
      );
    },
  });

  // ── Request Interceptor — log outgoing ────────────────────────────────────────
  client.interceptors.request.use((req: InternalAxiosRequestConfig) => {
    logger.debug({ method: req.method?.toUpperCase(), url: req.url, params: req.params, label }, '→ Request');
    return req;
  });

  // ── Response Interceptor — metrics + logging ──────────────────────────────────
  client.interceptors.response.use(
    (res: AxiosResponse) => {
      const endpoint = extractEndpointLabel(res.config.url);
      robloxApiRequests.inc({ endpoint, status: 'success' });

      logger.debug(
        { status: res.status, url: res.config.url, label },
        `← Response ${res.status}`,
      );

      // Warn if approaching rate limits
      const remaining = res.headers['x-ratelimit-remaining'];
      if (remaining !== undefined && Number(remaining) < 10) {
        logger.warn({ remaining, endpoint, label }, '⚠️  Rate limit nearly exhausted');
      }

      return res;
    },
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 0;
        const endpoint = extractEndpointLabel(error.config?.url);

        robloxApiRequests.inc({ endpoint, status: String(status) });

        if (status === 429) {
          robloxApiRateLimitHits.inc();
          logger.warn({ url: error.config?.url, label }, '🚫 Rate limited (429)');
        } else if (status >= 500) {
          logger.error({ status, url: error.config?.url, message: error.message, label }, '❌ Server error');
        } else if (status >= 400) {
          logger.warn({ status, url: error.config?.url, label }, '⚠️  Client error');
        } else {
          logger.error({ message: error.message, code: error.code, label }, '❌ Network error');
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}

function extractEndpointLabel(url: string | undefined): string {
  if (!url) return 'unknown';
  // Extract last meaningful path segment: /v1/users/avatar → users/avatar
  const match = /\/v\d+(\/[^?]+)/.exec(url);
  return match?.[1]?.replace(/^\//, '') ?? url;
}

/** Typed GET helper with full response */
export async function get<T>(
  client: AxiosInstance,
  path: string,
  params?: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await client.get<T>(path, { params, ...config });
  return res.data;
}

/** Typed POST helper */
export async function post<T>(
  client: AxiosInstance,
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await client.post<T>(path, body, config);
  return res.data;
}
