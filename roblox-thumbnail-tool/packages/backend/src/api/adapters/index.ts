// =============================================================================
// src/api/adapters/index.ts — Unified API Manager
// Single entry point for all external API access.
// Implements strategy pattern: Roblox primary → search fallbacks.
// =============================================================================

import { robloxAdapter, RobloxAdapter } from './robloxAdapter';
import { bingSearchAdapter, BingSearchAdapter } from './bingSearchAdapter';
import { duckDuckGoAdapter, DuckDuckGoAdapter } from './duckDuckGoAdapter';
import { createLogger } from '@observability/logger';
import { getBreakerStats } from '@api/circuitBreaker';
import type { PlayerThumbnail, Game, RobloxUser, GameIcon, GameThumbnailFetchOptions, ThumbnailSize } from '@app-types/roblox';
import type { SearchImageResult, CircuitBreakerStats } from '@app-types/api';

const logger = createLogger('api-manager');

export interface ApiManagerStatus {
  roblox: {
    thumbnailBreaker: CircuitBreakerStats;
    gamesBreaker: CircuitBreakerStats;
    usersBreaker: CircuitBreakerStats;
  };
  bing: { enabled: boolean };
  duckDuckGo: { enabled: boolean };
}

/**
 * Unified API Manager — orchestrates all external API calls.
 *
 * Usage:
 *   import { apiManager } from '@api/adapters';
 *   const thumbnails = await apiManager.fetchPlayerThumbnails([12345], { size: '720x720' });
 */
export class ApiManager {
  constructor(
    private readonly roblox: RobloxAdapter,
    private readonly bing: BingSearchAdapter,
    private readonly ddg: DuckDuckGoAdapter,
  ) {}

  // ── Player Thumbnails ────────────────────────────────────────────────────────
  async fetchPlayerThumbnails(
    userIds: number[],
    options: Parameters<RobloxAdapter['getPlayerThumbnails']>[1] = {},
  ): Promise<PlayerThumbnail[]> {
    return this.roblox.getPlayerThumbnails(userIds, options);
  }

  async fetchPlayerThumbnailsBatched(
    startId: number,
    endId: number,
    options: Parameters<RobloxAdapter['getPlayerThumbnails']>[1] = {},
    batchSize = 100,
    onBatch?: (thumbnails: PlayerThumbnail[], batchIndex: number) => Promise<void>,
  ): Promise<PlayerThumbnail[]> {
    const all: PlayerThumbnail[] = [];
    let batchIndex = 0;

    for (const batch of this.roblox.generateUserIdBatches(startId, endId, batchSize)) {
      logger.info({ batchIndex, batchSize: batch.length, startId: batch[0], endId: batch[batch.length - 1] }, '📦 Processing batch');

      const thumbnails = await this.roblox.getPlayerThumbnails(batch, options);
      all.push(...thumbnails);

      if (onBatch) {
        await onBatch(thumbnails, batchIndex);
      }

      batchIndex++;
    }

    return all;
  }

  // ── Games ────────────────────────────────────────────────────────────────────
  async fetchGameIcons(universeIds: number[], size?: string): Promise<GameIcon[]> {
    const opts: GameThumbnailFetchOptions = {};
    if (size) opts.size = size as ThumbnailSize;
    return this.roblox.getGameIcons(universeIds, opts);
  }

  async fetchPopularGames(limit = 100): Promise<Game[]> {
    return this.roblox.getPopularGames(limit);
  }

  async searchGames(keyword: string, limit = 100): Promise<Game[]> {
    return this.roblox.searchGames({ keyword, limit });
  }

  // ── Users ────────────────────────────────────────────────────────────────────
  async fetchUsers(userIds: number[]): Promise<RobloxUser[]> {
    return this.roblox.getUsers(userIds);
  }

  // ── Fallback Search ──────────────────────────────────────────────────────────
  /**
   * Search for game thumbnail images using fallback APIs.
   * Priority: Bing (if configured) → DuckDuckGo (metadata only)
   */
  async searchGameImages(gameName: string, count = 20): Promise<SearchImageResult[]> {
    if (this.bing.isEnabled) {
      const results = await this.bing.searchRobloxGameThumbnails(gameName, count);
      if (results.length > 0) return results;
    }

    logger.info({ gameName }, 'Bing unavailable — no fallback image search results');
    return [];
  }

  // ── Cache Invalidation ────────────────────────────────────────────────────────
  async invalidateUserCache(userIds: number[]): Promise<void> {
    await this.roblox.invalidateUserCache(userIds);
  }

  async invalidateGameCache(gameIds: number[]): Promise<void> {
    await this.roblox.invalidateGameCache(gameIds);
  }

  // ── Status ───────────────────────────────────────────────────────────────────
  getStatus(): Partial<ApiManagerStatus> {
    return {
      bing: { enabled: this.bing.isEnabled },
      duckDuckGo: { enabled: this.ddg.isEnabled },
      // Circuit breaker stats are accessible via getBreakerStats(breaker)
      // but the breakers are private on RobloxAdapter — expose via a method if needed
    };
  }
}

// Singleton export
export const apiManager = new ApiManager(robloxAdapter, bingSearchAdapter, duckDuckGoAdapter);

// Named re-exports for direct adapter access
export { robloxAdapter, bingSearchAdapter, duckDuckGoAdapter };
export type { RobloxAdapter, BingSearchAdapter, DuckDuckGoAdapter };
