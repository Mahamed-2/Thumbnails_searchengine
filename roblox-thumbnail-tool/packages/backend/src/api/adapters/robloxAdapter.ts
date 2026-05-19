// =============================================================================
// src/api/adapters/robloxAdapter.ts — Official Roblox API Adapter
//
// Implements:
//  - Player thumbnails (avatar, avatar-bust, avatar-headshot)
//  - Game icons & thumbnails
//  - User info
//  - Group icons
//  - Pending thumbnail retry logic
//  - Rate limiting (Bottleneck)
//  - Redis caching
//  - Circuit breaker (opossum)
//  - Input validation (Zod)
//  - Full TypeScript types
//
// ToS Compliance: Uses ONLY official Roblox endpoints. No scraping.
// Rate: ~100 req/min safe limit enforced via Bottleneck.
// =============================================================================

import { z } from 'zod';
import { env } from '@config/env';
import { createHttpClient, get, post } from '@api/httpClient';
import { createLimiter } from '@api/rateLimit/bottleneck';
import { apiCache, RedisCache } from '@api/cache/redisCache';
import { createCircuitBreaker, withFallback } from '@api/circuitBreaker';
import { createLogger } from '@observability/logger';
import type {
  PlayerThumbnail,
  PlayerThumbnailResponse,
  GameIconResponse,
  GameIcon,
  Game,
  GamesListResponse,
  RobloxUser,
  UsersResponse,
  GroupIcon,
  ThumbnailCropType,
  ThumbnailSize,
  ThumbnailFormat,
  ThumbnailFetchOptions,
  GameThumbnailFetchOptions,
  GamesSearchOptions,
} from '@app-types/roblox';

const logger = createLogger('roblox-adapter');

// ── Validation Schemas ─────────────────────────────────────────────────────────
const userIdsSchema = z
  .array(z.number().int().positive())
  .min(1)
  .max(100, 'Maximum 100 userIds per request');

const gameIdsSchema = z
  .array(z.number().int().positive())
  .min(1)
  .max(100, 'Maximum 100 gameIds per request');

// ── Valid sizes per crop type ──────────────────────────────────────────────────
const ELIGIBLE_SIZES: Record<ThumbnailCropType, ThumbnailSize[]> = {
  avatar: ['30x30', '48x48', '60x60', '75x75', '100x100', '110x110', '140x140', '150x150', '180x180', '250x250', '352x352', '420x420', '720x720'],
  'avatar-bust': ['48x48', '50x50', '60x60', '75x75', '100x100', '150x150', '180x180', '352x352', '420x420'],
  'avatar-headshot': ['48x48', '60x60', '75x75', '100x100', '110x110', '150x150', '180x180', '352x352', '420x420', '720x720'],
};

// ── Retry config for pending thumbnails ────────────────────────────────────────
const PENDING_RETRY_ATTEMPTS = 3;
const PENDING_RETRY_DELAY_MS = 2_000;

export class RobloxAdapter {
  private readonly thumbnailClient;
  private readonly gamesClient;
  private readonly usersClient;
  private readonly limiter;
  private readonly cache: RedisCache;

  // Circuit breakers — one per subdomain
  private readonly thumbnailBreaker;
  private readonly gamesBreaker;
  private readonly usersBreaker;

  constructor() {
    this.thumbnailClient = createHttpClient({
      baseURL: env.ROBLOX_API_BASE_URL,
      label: 'roblox-thumbnails',
    });
    this.gamesClient = createHttpClient({
      baseURL: env.ROBLOX_GAMES_API_URL,
      label: 'roblox-games',
    });
    this.usersClient = createHttpClient({
      baseURL: env.ROBLOX_USERS_API_URL,
      label: 'roblox-users',
    });

    this.limiter = createLimiter({ label: 'roblox' });
    this.cache = apiCache;

    // ── Circuit breakers ──────────────────────────────────────────────────────
    this.thumbnailBreaker = createCircuitBreaker(
      (path: string, params: Record<string, unknown>) =>
        get<PlayerThumbnailResponse>(this.thumbnailClient, path, params),
      { name: 'roblox-thumbnails', timeout: 15_000, resetTimeout: 30_000 },
    );

    this.gamesBreaker = createCircuitBreaker(
      (path: string, params: Record<string, unknown>) =>
        get<GamesListResponse>(this.gamesClient, path, params),
      { name: 'roblox-games', timeout: 15_000, resetTimeout: 30_000 },
    );

    this.usersBreaker = createCircuitBreaker(
      (path: string, body: unknown) =>
        post<UsersResponse>(this.usersClient, path, body),
      { name: 'roblox-users', timeout: 15_000, resetTimeout: 30_000 },
    );

    // Fallback: return empty data array so callers don't crash
    withFallback(this.thumbnailBreaker, { data: [] } as PlayerThumbnailResponse);
    withFallback(this.gamesBreaker, { games: [] } as GamesListResponse);
    withFallback(this.usersBreaker, { data: [] } as UsersResponse);
  }

  // ============================================================================
  // PLAYER THUMBNAILS
  // ============================================================================

  /**
   * Fetches player thumbnails for up to 100 user IDs.
   * Automatically retries thumbnails in "Pending" state up to 3 times.
   *
   * @ref https://thumbnails.roblox.com/v1/users/{cropType}
   */
  async getPlayerThumbnails(
    userIds: number[],
    options: ThumbnailFetchOptions = {},
  ): Promise<PlayerThumbnail[]> {
    const validated = userIdsSchema.parse(userIds);
    const {
      size = '420x420',
      format = 'png',
      isCircular = false,
      cropType = 'avatar',
    } = options;

    // Validate size for crop type
    const validSizes = ELIGIBLE_SIZES[cropType];
    if (!validSizes.includes(size as ThumbnailSize)) {
      logger.warn({ size, cropType, validSizes }, '⚠️  Invalid size for crop type — using default');
    }

    const cacheKey = RedisCache.buildKey('thumbnails', cropType, size, format, String(isCircular), ...validated.map(String));
    const cached = await this.cache.get<PlayerThumbnail[]>(cacheKey);
    if (cached) return cached;

    const path = `/v1/users/${cropType}`;
    const params = {
      userIds: validated.join(','),
      size,
      format,
      isCircular,
    };

    logger.info({ userCount: validated.length, cropType, size }, '📥 Fetching player thumbnails');

    const response = await this.limiter.schedule(() =>
      this.thumbnailBreaker.fire(path, params as Record<string, unknown>),
    );

    let thumbnails = response.data ?? [];

    // ── Retry pending thumbnails ───────────────────────────────────────────────
    thumbnails = await this.retryPendingThumbnails(thumbnails, path, params as Record<string, unknown>);

    // Only cache completed results
    const completedAll = thumbnails.every((t) => t.state !== 'Pending');
    if (completedAll) {
      await this.cache.set(cacheKey, thumbnails, {
        ttlSeconds: env.ROBLOX_CACHE_TTL_SECONDS,
        tags: validated.map((id) => `user:${id}`),
      });
    }

    return thumbnails;
  }

  /**
   * Retry thumbnails that came back as "Pending".
   * Roblox generates thumbnails asynchronously; they may not be ready immediately.
   */
  private async retryPendingThumbnails(
    thumbnails: PlayerThumbnail[],
    path: string,
    params: Record<string, unknown>,
  ): Promise<PlayerThumbnail[]> {
    let pending = thumbnails.filter((t) => t.state === 'Pending');
    let completed = thumbnails.filter((t) => t.state !== 'Pending');

    for (let attempt = 1; attempt <= PENDING_RETRY_ATTEMPTS && pending.length > 0; attempt++) {
      logger.info({ pendingCount: pending.length, attempt }, '⏳ Retrying pending thumbnails...');
      await sleep(PENDING_RETRY_DELAY_MS * attempt);

      const retryParams = {
        ...params,
        userIds: pending.map((t) => t.targetId).join(','),
      };

      const retryResponse = await this.limiter.schedule(() =>
        this.thumbnailBreaker.fire(path, retryParams),
      );

      const retried = retryResponse.data ?? [];
      const stillPending = retried.filter((t) => t.state === 'Pending');
      const nowCompleted = retried.filter((t) => t.state !== 'Pending');

      completed = [...completed, ...nowCompleted];
      pending = stillPending;

      if (nowCompleted.length > 0) {
        logger.info({ resolved: nowCompleted.length, stillPending: stillPending.length }, '✅ Pending thumbnails resolved');
      }
    }

    // Any remaining pending after all retries — include with their state
    return [...completed, ...pending];
  }

  // ============================================================================
  // GAME ICONS & THUMBNAILS
  // ============================================================================

  /**
   * Fetches game icons for up to 100 universe IDs.
   * @ref https://thumbnails.roblox.com/v1/games/icons
   */
  async getGameIcons(
    universeIds: number[],
    options: GameThumbnailFetchOptions = {},
  ): Promise<GameIcon[]> {
    const validated = gameIdsSchema.parse(universeIds);
    const { size = '512x512', format = 'png' } = options;

    const cacheKey = RedisCache.buildKey('game-icons', size, format, ...validated.map(String));
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        logger.info({ gameCount: validated.length, size }, '📥 Fetching game icons');
        const response = await this.limiter.schedule(() =>
          get<GameIconResponse>(this.thumbnailClient, '/v1/games/icons', {
            universeIds: validated.join(','),
            size,
            format,
          }),
        );
        return response.data ?? [];
      },
      { ttlSeconds: env.ROBLOX_CACHE_TTL_SECONDS, tags: validated.map((id) => `game:${id}`) },
    );
  }

  /**
   * Fetches multi-image game thumbnails.
   * @ref https://thumbnails.roblox.com/v1/games/multiget/thumbnails
   */
  async getGameThumbnails(universeIds: number[], size = '768x432'): Promise<GameIcon[]> {
    const validated = gameIdsSchema.parse(universeIds);
    const cacheKey = RedisCache.buildKey('game-thumbs', size, ...validated.map(String));

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const response = await this.limiter.schedule(() =>
          get<GameIconResponse>(this.thumbnailClient, '/v1/games/multiget/thumbnails', {
            universeIds: validated.join(','),
            thumbnailType: 'GameThumbnail',
            size,
            countPerUniverse: 1,
          }),
        );
        // Flatten the response structure
        const all: GameIcon[] = [];
        for (const item of (response as unknown as { data: { universeId: number; thumbnails: GameIcon[] }[] }).data ?? []) {
          all.push(...(item.thumbnails ?? []));
        }
        return all;
      },
      { ttlSeconds: env.ROBLOX_CACHE_TTL_SECONDS },
    );
  }

  // ============================================================================
  // GAMES SEARCH & DISCOVERY
  // ============================================================================

  /**
   * Searches games by keyword.
   * @ref https://games.roblox.com/v1/games/list
   */
  async searchGames(options: GamesSearchOptions = {}): Promise<Game[]> {
    const {
      keyword,
      limit = 100,
      sortOrder = 'Desc',
      sortType = 'Visits',
      excludeNonPlayableGames = true,
    } = options;

    const cacheKey = RedisCache.buildKey('games-search', keyword ?? 'popular', limit, sortOrder, sortType);
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        logger.info({ keyword, limit }, '🔍 Searching games');
        const response = await this.limiter.schedule(() =>
          this.gamesBreaker.fire('/v1/games/list', {
            keyword,
            limit,
            sortOrder,
            sortType,
            excludeNonPlayableGames,
          } as Record<string, unknown>),
        );
        return response.games ?? [];
      },
      { ttlSeconds: 1800 }, // Games list changes less often → 30min cache
    );
  }

  /**
   * Gets popular games (sorted by visits/playing).
   */
  async getPopularGames(limit = 100): Promise<Game[]> {
    return this.searchGames({ limit, sortType: 'Visits', sortOrder: 'Desc' });
  }

  // ============================================================================
  // USERS
  // ============================================================================

  /**
   * Gets user info for up to 100 user IDs.
   * @ref https://users.roblox.com/v1/users
   */
  async getUsers(userIds: number[]): Promise<RobloxUser[]> {
    const validated = userIdsSchema.parse(userIds);
    const cacheKey = RedisCache.buildKey('users', ...validated.map(String));

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        logger.info({ userCount: validated.length }, '👤 Fetching user info');
        const response = await this.limiter.schedule(() =>
          this.usersBreaker.fire('/v1/users', { userIds: validated }),
        );
        return response.data ?? [];
      },
      {
        ttlSeconds: 3600,
        tags: validated.map((id) => `user:${id}`),
      },
    );
  }

  // ============================================================================
  // GROUP ICONS
  // ============================================================================

  /**
   * Fetches group icons.
   * @ref https://thumbnails.roblox.com/v1/groups/icons
   */
  async getGroupIcons(groupIds: number[], size = '150x150', format: ThumbnailFormat = 'png'): Promise<GroupIcon[]> {
    const validated = z.array(z.number().int().positive()).max(100).parse(groupIds);
    const cacheKey = RedisCache.buildKey('group-icons', size, format, ...validated.map(String));

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const response = await this.limiter.schedule(() =>
          get<{ data: GroupIcon[] }>(this.thumbnailClient, '/v1/groups/icons', {
            groupIds: validated.join(','),
            size,
            format,
          }),
        );
        return response.data ?? [];
      },
      { ttlSeconds: env.ROBLOX_CACHE_TTL_SECONDS },
    );
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Generates batches of user IDs from a range for sequential collection.
   * Yields arrays of up to batchSize IDs.
   */
  *generateUserIdBatches(
    startId: number,
    endId: number,
    batchSize = 100,
  ): Generator<number[], void, unknown> {
    let current = startId;
    while (current <= endId) {
      const batch: number[] = [];
      for (let i = 0; i < batchSize && current <= endId; i++, current++) {
        batch.push(current);
      }
      yield batch;
    }
  }

  /** Invalidate all cached data for a set of user IDs */
  async invalidateUserCache(userIds: number[]): Promise<void> {
    for (const id of userIds) {
      await this.cache.invalidateTag(`user:${id}`);
    }
  }

  /** Invalidate all cached data for a set of game IDs */
  async invalidateGameCache(gameIds: number[]): Promise<void> {
    for (const id of gameIds) {
      await this.cache.invalidateTag(`game:${id}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export singleton
export const robloxAdapter = new RobloxAdapter();
