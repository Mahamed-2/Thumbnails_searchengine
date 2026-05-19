// =============================================================================
// tests/unit/api/robloxAdapter.spec.ts — RobloxAdapter unit tests
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ── Mocks ──────────────────────────────────────────────────────────────────────
jest.mock('@queue/redis', () => ({
  getRedisConnection: jest.fn(() => ({
    get: jest.fn<any>().mockResolvedValue(null),
    set: jest.fn<any>().mockResolvedValue('OK'),
    del: jest.fn<any>().mockResolvedValue(1),
    sadd: jest.fn<any>().mockResolvedValue(1),
    smembers: jest.fn<any>().mockResolvedValue([]),
    expire: jest.fn<any>().mockResolvedValue(1),
    pipeline: jest.fn<any>(() => ({
      set: jest.fn<any>().mockReturnThis(),
      sadd: jest.fn<any>().mockReturnThis(),
      expire: jest.fn<any>().mockReturnThis(),
      del: jest.fn<any>().mockReturnThis(),
      exec: jest.fn<any>().mockResolvedValue([]),
    })),
  })),
}));

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

// Mock axios before importing adapter
const mockGet = jest.fn<any>();
const mockPost = jest.fn<any>();

jest.mock('axios', () => {
  const actual = jest.requireActual<typeof import('axios')>('axios');
  return {
    ...actual,
    create: jest.fn<any>(() => ({
      get: mockGet,
      post: mockPost,
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
    isAxiosError: jest.fn<any>(() => false),
  };
});

jest.mock('axios-retry', () => jest.fn<any>());

jest.mock('opossum', () => {
  const MockBreaker = jest.fn<any>().mockImplementation((_fn: any) => ({
    fire: jest.fn<any>(async (...args: any[]) => _fn(...args)),
    on: jest.fn<any>(),
    opened: false,
    halfOpen: false,
    stats: { failures: 0, successes: 0, fires: 0, fallbacks: 0 },
    fallback: jest.fn<any>(),
    name: 'mock-breaker',
  }));
  return MockBreaker;
});

jest.mock('bottleneck', () => {
  const MockBottleneck = jest.fn<any>().mockImplementation(() => ({
    schedule: jest.fn<any>((fn: any) => fn()),
    on: jest.fn<any>(),
    counts: jest.fn<any>(() => ({ QUEUED: 0 })),
  }));
  (MockBottleneck as any).strategy = { OVERFLOW: 'OVERFLOW' };
  return MockBottleneck;
});

// Import the adapter after mocks are set up
import { RobloxAdapter } from '../../../src/api/adapters/robloxAdapter';
import { RedisCache } from '../../../src/api/cache/redisCache';
import type { PlayerThumbnail } from '../../../src/types/roblox';

// ── Helpers ────────────────────────────────────────────────────────────────────
const makeThumbnail = (targetId: number, state: PlayerThumbnail['state'] = 'Completed'): PlayerThumbnail => ({
  targetId,
  state,
  imageUrl: state === 'Completed' ? `https://tr.rbxcdn.com/user/${targetId}.png` : null,
});

const mockThumbnailResponse = (thumbnails: PlayerThumbnail[]) => ({
  data: thumbnails,
});

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('RobloxAdapter', () => {
  let adapter: RobloxAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new RobloxAdapter();
    mockGet.mockResolvedValue({ data: mockThumbnailResponse([]) });
    mockPost.mockResolvedValue({ data: { data: [] } });
  });

  // ── Input validation ─────────────────────────────────────────────────────────
  describe('getPlayerThumbnails — input validation', () => {
    it('should throw if more than 100 user IDs are provided', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => i + 1);
      await expect(adapter.getPlayerThumbnails(ids)).rejects.toThrow('Maximum 100 userIds per request');
    });

    it('should throw if an empty array is provided', async () => {
      await expect(adapter.getPlayerThumbnails([])).rejects.toThrow();
    });

    it('should throw if a negative user ID is provided', async () => {
      await expect(adapter.getPlayerThumbnails([-1])).rejects.toThrow();
    });

    it('should accept exactly 100 user IDs', async () => {
      const ids = Array.from({ length: 100 }, (_, i) => i + 1);
      mockGet.mockResolvedValue({ data: mockThumbnailResponse(ids.map((id) => makeThumbnail(id))) });
      await expect(adapter.getPlayerThumbnails(ids)).resolves.not.toThrow();
    });
  });

  // ── Happy path ───────────────────────────────────────────────────────────────
  describe('getPlayerThumbnails — happy path', () => {
    it('returns completed thumbnails', async () => {
      const expected = [makeThumbnail(123), makeThumbnail(456)];
      mockGet.mockResolvedValue({ data: mockThumbnailResponse(expected) });

      const result = await adapter.getPlayerThumbnails([123, 456]);
      expect(result).toHaveLength(2);
      expect(result[0]?.state).toBe('Completed');
      expect(result[0]?.imageUrl).toContain('123');
    });

    it('includes failed/blocked thumbnails without retrying them', async () => {
      const thumbnails = [makeThumbnail(1, 'Completed'), makeThumbnail(2, 'Blocked')];
      mockGet.mockResolvedValue({ data: mockThumbnailResponse(thumbnails) });

      const result = await adapter.getPlayerThumbnails([1, 2]);
      expect(result).toHaveLength(2);
      const blocked = result.find((t) => t.targetId === 2);
      expect(blocked?.state).toBe('Blocked');
    });
  });

  // ── Pending retry logic ───────────────────────────────────────────────────────
  describe('getPlayerThumbnails — pending retry', () => {
    it('retries pending thumbnails and resolves them', async () => {
      const pending = makeThumbnail(999, 'Pending');
      const resolved = makeThumbnail(999, 'Completed');

      mockGet
        .mockResolvedValueOnce({ data: mockThumbnailResponse([pending]) })  // First call
        .mockResolvedValueOnce({ data: mockThumbnailResponse([resolved]) }); // Retry

      const result = await adapter.getPlayerThumbnails([999]);
      expect(result).toHaveLength(1);
      expect(result[0]?.state).toBe('Completed');
    });
  });

  // ── Batch generator ───────────────────────────────────────────────────────────
  describe('generateUserIdBatches', () => {
    it('generates correct batches from a range', () => {
      const batches = [...adapter.generateUserIdBatches(1, 250, 100)];
      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(100);
      expect(batches[0]?.[0]).toBe(1);
      expect(batches[1]).toHaveLength(100);
      expect(batches[2]).toHaveLength(50);
      expect(batches[2]?.[batches[2].length - 1]).toBe(250);
    });

    it('handles a single-item range', () => {
      const batches = [...adapter.generateUserIdBatches(42, 42, 100)];
      expect(batches).toHaveLength(1);
      expect(batches[0]).toEqual([42]);
    });

    it('handles a range smaller than batch size', () => {
      const batches = [...adapter.generateUserIdBatches(1, 5, 100)];
      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(5);
    });
  });

  // ── Cache key builder ─────────────────────────────────────────────────────────
  describe('RedisCache.buildKey', () => {
    it('builds a deterministic key from parts', () => {
      const key = RedisCache.buildKey('thumbnails', 'avatar', '720x720', 'png', '123', '456');
      expect(key).toBe('thumbnails:avatar:720x720:png:123:456');
    });

    it('sanitizes special characters', () => {
      const key = RedisCache.buildKey('test', 'a b/c');
      expect(key).not.toContain(' ');
      expect(key).not.toContain('/');
    });
  });
});
