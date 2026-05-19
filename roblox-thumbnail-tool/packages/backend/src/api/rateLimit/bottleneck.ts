// =============================================================================
// src/api/rateLimit/bottleneck.ts — Bottleneck limiter factory
// Enforces Roblox's ~100 req/min safe rate limit with burst protection.
// =============================================================================

import Bottleneck from 'bottleneck';
import { env } from '@config/env';
import { createLogger } from '@observability/logger';
import { queueDepth } from '@observability/metrics';

const logger = createLogger('rate-limiter');

// One shared limiter for all Roblox API calls
let sharedLimiter: Bottleneck | null = null;

export interface LimiterConfig {
  maxConcurrent?: number;
  minTime?: number;        // ms between requests
  reservoir?: number;      // max tokens in bucket
  reservoirRefreshAmount?: number;
  reservoirRefreshInterval?: number; // ms
  label?: string;
}

/**
 * Creates a Bottleneck limiter with:
 * - Token bucket (reservoir) for burst control
 * - Max concurrent requests
 * - Minimum time between requests
 * - Queue depth metric reporting
 */
export function createLimiter(config: LimiterConfig = {}): Bottleneck {
  const {
    maxConcurrent = env.ROBLOX_RATE_LIMIT_MAX_CONCURRENT,
    minTime = env.ROBLOX_RATE_LIMIT_MIN_TIME,
    reservoir = 100,
    reservoirRefreshAmount = 100,
    reservoirRefreshInterval = 60_000, // Refill 100 tokens per minute
    label = 'default',
  } = config;

  const limiter = new Bottleneck({
    maxConcurrent,
    minTime,
    reservoir,
    reservoirRefreshAmount,
    reservoirRefreshInterval,
    // High-water mark: drop jobs if queue grows beyond 1000 waiting
    highWater: 1000,
    strategy: Bottleneck.strategy.OVERFLOW,
  });

  // ── Queue monitoring ─────────────────────────────────────────────────────────
  let monitorInterval: NodeJS.Timeout | null = null;

  limiter.on('queued', () => {
    if (!monitorInterval) {
      monitorInterval = setInterval(() => {
        const counts = limiter.counts();
        queueDepth.set({ queue: `rate-limiter:${label}` }, counts.QUEUED);

        if (counts.QUEUED > 50) {
          logger.warn({ counts, label }, '⚠️  Rate limiter queue is growing');
        }
      }, 5_000);
    }
  });

  limiter.on('idle', () => {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
    queueDepth.set({ queue: `rate-limiter:${label}` }, 0);
  });

  limiter.on('error', (err) => {
    logger.error({ err, label }, '❌ Rate limiter error');
  });

  limiter.on('dropped', () => {
    logger.warn({ label }, '🚫 Rate limiter dropped a job (queue overflow)');
  });

  logger.info({ maxConcurrent, minTime, reservoir, label }, '✅ Rate limiter created');
  return limiter;
}

/**
 * Returns the shared singleton limiter for Roblox API calls.
 * Workers that need independent limiters should call createLimiter() directly.
 */
export function getSharedRobloxLimiter(): Bottleneck {
  if (!sharedLimiter) {
    sharedLimiter = createLimiter({ label: 'roblox-shared' });
  }
  return sharedLimiter;
}

/**
 * Wraps an async function with the shared limiter.
 * Convenience helper for one-off calls.
 */
export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return getSharedRobloxLimiter().schedule(fn);
}
