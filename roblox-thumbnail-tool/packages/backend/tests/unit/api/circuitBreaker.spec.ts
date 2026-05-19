// =============================================================================
// tests/unit/api/circuitBreaker.spec.ts — Circuit breaker unit tests
// =============================================================================

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@observability/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@observability/metrics', () => ({
  robloxApiRequests: { inc: jest.fn() },
  robloxApiRateLimitHits: { inc: jest.fn() },
  queueDepth: { set: jest.fn() },
}));

import { createCircuitBreaker, getBreakerStats } from '../../../src/api/circuitBreaker';

describe('createCircuitBreaker', () => {
  it('calls the wrapped function and returns its result', async () => {
    const fn = jest.fn<() => Promise<string>>().mockResolvedValue('hello');
    const breaker = createCircuitBreaker(fn, { name: 'test', volumeThreshold: 1 });

    const result = await breaker.fire();
    expect(result).toBe('hello');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from the wrapped function', async () => {
    const fn = jest.fn<() => Promise<never>>().mockRejectedValue(new Error('API down'));
    const breaker = createCircuitBreaker(fn, { name: 'error-test', volumeThreshold: 1 });

    await expect(breaker.fire()).rejects.toThrow('API down');
  });
});

describe('getBreakerStats', () => {
  it('returns closed state for a healthy breaker', async () => {
    const fn = jest.fn<() => Promise<string>>().mockResolvedValue('ok');
    const breaker = createCircuitBreaker(fn, { name: 'stats-test' });

    const stats = getBreakerStats(breaker);
    expect(stats.state).toBe('closed');
    expect(typeof stats.failures).toBe('number');
    expect(typeof stats.successes).toBe('number');
  });
});
