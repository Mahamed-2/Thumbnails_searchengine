// =============================================================================
// src/queue/redis.ts — Redis connection for BullMQ
// =============================================================================

import Redis from 'ioredis';
import { env } from '@config/env';
import { createLogger } from '@observability/logger';

const logger = createLogger('redis');

let redisClient: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisClient) {
    redisClient = env.REDIS_URL
      ? new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: null, // Required by BullMQ
          enableReadyCheck: false,
          lazyConnect: true,
        })
      : new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD || undefined,
          db: env.REDIS_DB,
          maxRetriesPerRequest: null, // Required by BullMQ
          enableReadyCheck: false,
          lazyConnect: true,
          retryStrategy: (times) => {
            const delay = Math.min(times * 500, 5000);
            logger.warn({ times, delay }, '⚠️  Redis reconnecting...');
            return delay;
          },
        });

    redisClient.on('connect', () => logger.info('🔴 Redis connected'));
    redisClient.on('ready', () => logger.info('✅ Redis ready'));
    redisClient.on('error', (err) => logger.error({ err }, '❌ Redis error'));
    redisClient.on('close', () => logger.warn('🔴 Redis connection closed'));
    redisClient.on('reconnecting', () => logger.warn('🔄 Redis reconnecting...'));
  }

  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisConnection();
  await client.connect();
  await client.ping();
  logger.info('✅ Redis ping successful');
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('✅ Redis disconnected');
  }
}

/** Returns a NEW Redis connection — needed for BullMQ workers (separate connection per worker) */
export function createRedisConnection(): Redis {
  return env.REDIS_URL
    ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false })
    : new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        db: env.REDIS_DB,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
}
