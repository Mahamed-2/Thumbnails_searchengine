// =============================================================================
// src/api/adapters/duckDuckGoAdapter.ts — DuckDuckGo Instant Answer fallback
// No API key required. Free. Uses instant answer API (not image search).
// Note: DuckDuckGo does NOT have an official image search API.
//       This adapter uses the Instant Answer API for text-based supplementation.
// =============================================================================

import { env } from '@config/env';
import { createHttpClient, get } from '@api/httpClient';
import { createLimiter } from '@api/rateLimit/bottleneck';
import { apiCache, RedisCache } from '@api/cache/redisCache';
import { createLogger } from '@observability/logger';

const logger = createLogger('duckduckgo-adapter');

interface DuckDuckGoInstantAnswer {
  Abstract: string;
  AbstractText: string;
  AbstractSource: string;
  AbstractURL: string;
  Image: string;
  ImageWidth: number;
  ImageHeight: number;
  RelatedTopics: Array<{
    Text: string;
    FirstURL: string;
    Icon?: { URL: string; Width: number; Height: number };
  }>;
  Type: string;
  Heading: string;
}

export interface DuckDuckGoResult {
  heading: string;
  abstract: string;
  imageUrl?: string;
  relatedImages: string[];
  sourceUrl: string;
}

export class DuckDuckGoAdapter {
  private readonly client;
  private readonly limiter;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = env.DUCKDUCKGO_ENABLED;

    this.client = createHttpClient({
      baseURL: 'https://api.duckduckgo.com',
      label: 'duckduckgo',
      timeout: 8_000,
    });

    // Be conservative — this is a public free API
    this.limiter = createLimiter({
      label: 'duckduckgo',
      maxConcurrent: 1,
      minTime: 1_000, // 1 req/sec max
      reservoir: 10,
      reservoirRefreshAmount: 10,
      reservoirRefreshInterval: 10_000,
    });
  }

  /**
   * Query the DuckDuckGo Instant Answer API.
   * Useful for game metadata enrichment (abstract, related topics).
   */
  async instantAnswer(query: string): Promise<DuckDuckGoResult | null> {
    if (!this.enabled) return null;

    const cacheKey = RedisCache.buildKey('ddg', query);
    const cached = await apiCache.get<DuckDuckGoResult>(cacheKey);
    if (cached) return cached;

    try {
      logger.info({ query }, '🦆 DuckDuckGo instant answer');

      const response = await this.limiter.schedule(() =>
        get<DuckDuckGoInstantAnswer>(this.client, '/', {
          q: query,
          format: 'json',
          no_html: 1,
          skip_disambig: 1,
        }),
      );

      if (!response.Heading) {
        logger.debug({ query }, 'No DuckDuckGo result found');
        return null;
      }

      const result: DuckDuckGoResult = {
        heading: response.Heading,
        abstract: response.AbstractText,
        ...(response.Image ? { imageUrl: response.Image } : {}),
        relatedImages: response.RelatedTopics
          .filter((t) => t.Icon?.URL)
          .map((t) => t.Icon!.URL)
          .slice(0, 10),
        sourceUrl: response.AbstractURL,
      };

      await apiCache.set(cacheKey, result, { ttlSeconds: 86400 }); // Cache for 24h
      return result;
    } catch (err) {
      logger.warn({ err, query }, '⚠️  DuckDuckGo query failed');
      return null;
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }
}

export const duckDuckGoAdapter = new DuckDuckGoAdapter();
