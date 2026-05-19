// =============================================================================
// src/api/adapters/bingSearchAdapter.ts — Bing Image Search fallback adapter
// Used for game thumbnail supplementation (NOT for player avatars).
// Free tier: 1,000 calls/month via Azure Cognitive Services.
// ToS: Only supplement official API results. Respect Bing terms of use.
// =============================================================================

import { z } from 'zod';
import { env } from '@config/env';
import { createHttpClient, get } from '@api/httpClient';
import { createLimiter } from '@api/rateLimit/bottleneck';
import { apiCache, RedisCache } from '@api/cache/redisCache';
import { createLogger } from '@observability/logger';
import type { SearchImageResult } from '@app-types/api';

const logger = createLogger('bing-adapter');

interface BingImageValue {
  name: string;
  contentUrl: string;
  hostPageUrl: string;
  width: number;
  height: number;
  thumbnailUrl: string;
  encodingFormat: string;
}

interface BingImageSearchResponse {
  _type: string;
  value: BingImageValue[];
  totalEstimatedMatches?: number;
  nextOffset?: number;
}

const searchOptionsSchema = z.object({
  query: z.string().min(1).max(500),
  count: z.number().int().min(1).max(150).default(50),
  offset: z.number().int().min(0).default(0),
  safeSearch: z.enum(['Off', 'Moderate', 'Strict']).default('Moderate'),
  imageType: z.enum(['AnimatedGif', 'Clipart', 'Line', 'Photo', 'Shopping', 'Transparent']).optional(),
  minWidth: z.number().int().positive().optional(),
  minHeight: z.number().int().positive().optional(),
});

type SearchOptions = z.infer<typeof searchOptionsSchema>;

export class BingSearchAdapter {
  private readonly client;
  private readonly limiter;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = Boolean(env.BING_API_KEY);

    if (!this.enabled) {
      logger.info('ℹ️  Bing adapter disabled — no BING_API_KEY configured');
    }

    this.client = createHttpClient({
      baseURL: 'https://api.bing.microsoft.com/v7.0',
      label: 'bing-search',
      timeout: 10_000,
    });

    // Bing free tier: 3 calls/sec max, 1000/month
    this.limiter = createLimiter({
      label: 'bing',
      maxConcurrent: 2,
      minTime: 400, // ~2.5 req/sec (safe margin below 3/sec)
      reservoir: 50,
      reservoirRefreshAmount: 50,
      reservoirRefreshInterval: 20_000,
    });

    // Set API key header on the client
    if (env.BING_API_KEY) {
      this.client.defaults.headers.common['Ocp-Apim-Subscription-Key'] = env.BING_API_KEY;
    }
  }

  /**
   * Search for images related to a query.
   * Returns null if Bing is not configured.
   */
  async searchImages(options: SearchOptions): Promise<SearchImageResult[] | null> {
    if (!this.enabled) {
      logger.debug('Bing search skipped — adapter not enabled');
      return null;
    }

    const validated = searchOptionsSchema.parse(options);
    const cacheKey = RedisCache.buildKey(
      'bing-search',
      validated.query,
      validated.count,
      validated.offset,
      validated.safeSearch,
    );

    const cached = await apiCache.get<SearchImageResult[]>(cacheKey);
    if (cached) return cached;

    try {
      logger.info({ query: validated.query, count: validated.count }, '🔍 Bing image search');

      const response = await this.limiter.schedule(() =>
        get<BingImageSearchResponse>(this.client, '/images/search', {
          q: validated.query,
          count: validated.count,
          offset: validated.offset,
          mkt: 'en-US',
          safeSearch: validated.safeSearch,
          ...(validated.imageType && { imageType: validated.imageType }),
          ...(validated.minWidth && { minWidth: validated.minWidth }),
          ...(validated.minHeight && { minHeight: validated.minHeight }),
        }),
      );

      const results: SearchImageResult[] = (response.value ?? []).map((img) => ({
        url: img.contentUrl,
        thumbnailUrl: img.thumbnailUrl,
        name: img.name,
        width: img.width,
        height: img.height,
        format: img.encodingFormat,
        source: 'bing' as const,
      }));

      // Cache for 2 hours (search results don't change rapidly)
      await apiCache.set(cacheKey, results, { ttlSeconds: 7200 });

      logger.info({ query: validated.query, resultCount: results.length }, '✅ Bing search complete');
      return results;
    } catch (err) {
      logger.error({ err, query: validated.query }, '❌ Bing search failed');
      return null;
    }
  }

  /**
   * Convenience: search for Roblox game thumbnails by game name.
   */
  async searchRobloxGameThumbnails(gameName: string, count = 20): Promise<SearchImageResult[]> {
    const query = `Roblox "${gameName}" game thumbnail`;
    const results = await this.searchImages({
      query,
      count,
      offset: 0,
      safeSearch: 'Moderate',
      imageType: 'Photo',
      minWidth: 400,
      minHeight: 200,
    });
    return results ?? [];
  }

  get isEnabled(): boolean {
    return this.enabled;
  }
}

export const bingSearchAdapter = new BingSearchAdapter();
