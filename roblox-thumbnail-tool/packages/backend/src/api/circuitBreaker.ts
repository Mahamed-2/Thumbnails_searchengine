// =============================================================================
// src/api/circuitBreaker.ts — opossum circuit breaker wrapper
// Prevents hammering Roblox APIs during outages with automatic recovery.
// =============================================================================

import CircuitBreaker from 'opossum';
import { createLogger } from '@observability/logger';
import type { CircuitBreakerStats } from '@app-types/api';

const logger = createLogger('circuit-breaker');

export interface CircuitBreakerConfig {
  timeout?: number;            // ms before a request is considered failed (default: 10s)
  errorThresholdPercentage?: number; // % errors to trip the breaker (default: 50)
  resetTimeout?: number;       // ms to wait before half-open (default: 30s)
  volumeThreshold?: number;    // Min requests before tripping is possible (default: 5)
  name?: string;
}

/**
 * Wraps an async function in an opossum circuit breaker.
 *
 * States:
 *  - CLOSED (normal): requests pass through
 *  - OPEN (tripped): requests fail immediately with fallback
 *  - HALF-OPEN (recovery): one test request is allowed
 */
export function createCircuitBreaker<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  config: CircuitBreakerConfig = {},
): CircuitBreaker<T, R> {
  const {
    timeout = 10_000,
    errorThresholdPercentage = 50,
    resetTimeout = 30_000,
    volumeThreshold = 5,
    name = 'default',
  } = config;

  const breaker = new CircuitBreaker(fn, {
    timeout,
    errorThresholdPercentage,
    resetTimeout,
    volumeThreshold,
    name,
  });

  // ── Event handlers ──────────────────────────────────────────────────────────
  breaker.on('open', () => {
    logger.warn({ name }, '🔴 Circuit breaker OPENED — blocking requests');
  });

  breaker.on('halfOpen', () => {
    logger.info({ name }, '🟡 Circuit breaker HALF-OPEN — testing recovery');
  });

  breaker.on('close', () => {
    logger.info({ name }, '🟢 Circuit breaker CLOSED — normal operation resumed');
  });

  breaker.on('fallback', (result, err) => {
    logger.warn({ name, err: (err as Error)?.message, result }, '↩️  Circuit breaker fallback triggered');
  });

  breaker.on('reject', () => {
    logger.warn({ name }, '🚫 Circuit breaker rejected request (open state)');
  });

  breaker.on('timeout', () => {
    logger.warn({ name }, '⏰ Circuit breaker timeout');
  });

  breaker.on('success', () => {
    logger.debug({ name }, '✅ Circuit breaker success');
  });

  breaker.on('failure', (err) => {
    logger.warn({ name, err: (err as Error)?.message }, '❌ Circuit breaker failure recorded');
  });

  return breaker;
}

/**
 * Wraps a circuit breaker with a fallback value.
 * The fallback is returned when the breaker is open or the call fails.
 */
export function withFallback<T extends unknown[], R>(
  breaker: CircuitBreaker<T, R>,
  fallback: R | ((...args: T) => R),
): CircuitBreaker<T, R> {
  breaker.fallback(fallback as (...args: T) => R);
  return breaker;
}

/**
 * Extracts current stats from a circuit breaker.
 */
export function getBreakerStats(breaker: CircuitBreaker<unknown[], unknown>): CircuitBreakerStats {
  const stats = breaker.stats;
  return {
    state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
    failures: stats.failures ?? 0,
    successes: stats.successes ?? 0,
    requests: stats.fires ?? 0,
    fallbacks: stats.fallbacks ?? 0,
  };
}
