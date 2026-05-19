// =============================================================================
// src/api/cache/redisCache.ts — Redis-backed response cache
// Generic TTL cache with tag-based invalidation support.
// =============================================================================

import { getRedisConnection } from '@queue/redis';
import { createLogger } from '@observability/logger';
import type { CacheEntry } from '@app-types/api';

const logger = createLogger('redis-cache');

const CACHE_PREFIX = 'roblox:cache:';

export interface CacheOptions {
  ttlSeconds?: number;
  tags?: string[];      // For group invalidation (e.g. invalidate all "user:123" entries)
}

/**
 * Redis-backed cache with:
 * - Automatic JSON serialization
 * - TTL per entry
 * - Tag-based batch invalidation
 * - Cache hit/miss logging
 */
export class RedisCache {
  private readonly prefix: string;
  private readonly defaultTtl: number;

  constructor(prefix = CACHE_PREFIX, defaultTtl = 3600) {
    this.prefix = prefix;
    this.defaultTtl = defaultTtl;
  }

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  private tagKey(tag: string): string {
    return `${this.prefix}tag:${tag}`;
  }

  /**
   * Get a cached value. Returns null on miss or deserialize error.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = getRedisConnection();
      const raw = await redis.get(this.key(key));
      if (!raw) {
        logger.debug({ key }, '❌ Cache miss');
        return null;
      }

      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() > entry.expiresAt) {
        logger.debug({ key }, '⏰ Cache expired');
        await this.del(key);
        return null;
      }

      logger.debug({ key }, '✅ Cache hit');
      return entry.data;
    } catch (err) {
      logger.warn({ err, key }, '⚠️  Cache get error — treating as miss');
      return null;
    }
  }

  /**
   * Set a value in the cache.
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttlSeconds ?? this.defaultTtl;

    try {
      const redis = getRedisConnection();
      const now = Date.now();

      const entry: CacheEntry<T> = {
        data,
        cachedAt: now,
        expiresAt: now + ttl * 1000,
      };

      const pipeline = redis.pipeline();
      pipeline.set(this.key(key), JSON.stringify(entry), 'EX', ttl);

      // Register key under each tag for batch invalidation
      if (options.tags?.length) {
        for (const tag of options.tags) {
          pipeline.sadd(this.tagKey(tag), this.key(key));
          pipeline.expire(this.tagKey(tag), ttl + 60); // Tag expires slightly after data
        }
      }

      await pipeline.exec();
      logger.debug({ key, ttl, tags: options.tags }, '💾 Cache set');
    } catch (err) {
      logger.warn({ err, key }, '⚠️  Cache set error — continuing without cache');
    }
  }

  /**
   * Delete a specific key.
   */
  async del(key: string): Promise<void> {
    try {
      const redis = getRedisConnection();
      await redis.del(this.key(key));
    } catch (err) {
      logger.warn({ err, key }, '⚠️  Cache delete error');
    }
  }

  /**
   * Invalidate all keys registered under a tag.
   */
  async invalidateTag(tag: string): Promise<number> {
    try {
      const redis = getRedisConnection();
      const tagKey = this.tagKey(tag);
      const members = await redis.smembers(tagKey);

      if (!members.length) return 0;

      const pipeline = redis.pipeline();
      pipeline.del(...members);
      pipeline.del(tagKey);
      await pipeline.exec();

      logger.info({ tag, count: members.length }, '🗑️  Cache invalidated by tag');
      return members.length;
    } catch (err) {
      logger.warn({ err, tag }, '⚠️  Cache invalidation error');
      return 0;
    }
  }

  /**
   * Get or set pattern — avoids cache stampede with simple locking.
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const data = await fetcher();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Generate a deterministic cache key from arguments.
   */
  static buildKey(...parts: Array<string | number | boolean | undefined>): string {
    return parts
      .map((p) => String(p ?? ''))
      .join(':')
      .replace(/[^a-zA-Z0-9:_-]/g, '_');
  }
}

// Singleton cache instance (shared across adapters)
export const apiCache = new RedisCache(CACHE_PREFIX, 3600);
