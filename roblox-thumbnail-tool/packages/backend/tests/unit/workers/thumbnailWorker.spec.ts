// =============================================================================
// tests/unit/workers/thumbnailWorker.spec.ts — ThumbnailWorker unit tests
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ── Setup mocks before imports ─────────────────────────────────────────────────

jest.mock('@queue/redis', () => ({
  getRedisConnection: jest.fn<any>(() => ({})),
  createRedisConnection: jest.fn<any>(() => ({})),
}));

jest.mock('@observability/logger', () => ({
  createLogger: jest.fn<any>(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

jest.mock('@observability/metrics', () => ({
  robloxApiRequests: { inc: jest.fn() },
  robloxApiRateLimitHits: { inc: jest.fn() },
  queueDepth: { set: jest.fn() },
  queueJobsTotal: { inc: jest.fn() },
  queueJobDuration: { observe: jest.fn() },
  thumbnailsCollected: { inc: jest.fn() },
  thumbnailsFailed: { inc: jest.fn() },
}));

// Mock BullMQ Worker
jest.mock('bullmq', () => ({
  Worker: jest.fn<any>().mockImplementation((_name: string, processor: any, _opts: any) => ({
    name: _name,
    processor,
    on: jest.fn<any>(),
    close: jest.fn<any>().mockResolvedValue(undefined),
    closing: false,
    closed: false,
  })),
  Queue: jest.fn<any>().mockImplementation(() => ({
    add: jest.fn<any>().mockResolvedValue({ id: 'bull-job-1' }),
    close: jest.fn<any>().mockResolvedValue(undefined),
    getJobCounts: jest.fn<any>().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
  })),
  FlowProducer: jest.fn<any>().mockImplementation(() => ({
    close: jest.fn<any>().mockResolvedValue(undefined),
  })),
}));

// Mock Prisma DB
const mockPrisma = {
  collectionJob: {
    update: jest.fn<any>().mockResolvedValue({}),
    findUnique: jest.fn<any>().mockResolvedValue({ status: 'running' }),
  },
  thumbnail: {
    upsert: jest.fn<any>().mockResolvedValue({}),
  },
  user: {
    upsert: jest.fn<any>().mockResolvedValue({}),
  },
  game: {
    upsert: jest.fn<any>().mockResolvedValue({}),
  },
  dLQEntry: {
    create: jest.fn<any>().mockResolvedValue({}),
  },
};

jest.mock('@database/client', () => ({ db: mockPrisma }));

// Mock apiManager
const mockFetchPlayerThumbnails = jest.fn<any>();
const mockFetchPopularGames = jest.fn<any>();
const mockSearchGames = jest.fn<any>();
const mockFetchGameIcons = jest.fn<any>();

jest.mock('@api/adapters', () => ({
  apiManager: {
    fetchPlayerThumbnails: mockFetchPlayerThumbnails,
    fetchPopularGames: mockFetchPopularGames,
    searchGames: mockSearchGames,
    fetchGameIcons: mockFetchGameIcons,
    roblox: {
      generateUserIdBatches: function* (start: number, end: number, batchSize: number) {
        let current = start;
        while (current <= end) {
          const batch: number[] = [];
          for (let i = 0; i < batchSize && current <= end; i++, current++) {
            batch.push(current);
          }
          yield batch;
        }
      },
    },
  },
}));

jest.mock('@workers/progressEmitter', () => ({
  progressEmitter: {
    emitProgress: jest.fn(),
    emitStatus: jest.fn(),
  },
}));

jest.mock('@queue/queues', () => ({
  QUEUE_NAMES: { THUMBNAIL: 'thumbnail-collection', EXPORT: 'dataset-export', DLQ: 'thumbnail-dlq' },
  getThumbnailQueue: jest.fn<any>(() => ({
    add: jest.fn<any>().mockResolvedValue({ id: 'bull-1' }),
    close: jest.fn<any>(),
    getJobCounts: jest.fn<any>().mockResolvedValue({}),
  })),
  sendToDLQ: jest.fn<any>().mockResolvedValue(undefined),
  closeAllQueues: jest.fn<any>().mockResolvedValue(undefined),
}));

// ── Import after all mocks ─────────────────────────────────────────────────────
import { createThumbnailWorker } from '../../../src/workers/thumbnailWorker';

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('createThumbnailWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: job is not cancelled
    mockPrisma.collectionJob.findUnique.mockResolvedValue({ status: 'running' });
    mockPrisma.collectionJob.update.mockResolvedValue({});
    mockPrisma.thumbnail.upsert.mockResolvedValue({});
    mockPrisma.user.upsert.mockResolvedValue({});
  });

  it('creates and returns a BullMQ Worker instance', () => {
    const worker = createThumbnailWorker();
    expect(worker).toBeDefined();
    expect(worker.name).toBe('thumbnail-collection');
  });

  it('worker has event listeners registered', () => {
    const worker = createThumbnailWorker();
    expect(worker.on).toHaveBeenCalledWith('active', expect.any(Function));
    expect(worker.on).toHaveBeenCalledWith('completed', expect.any(Function));
    expect(worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
  });
});

describe('ThumbnailWorker — user-range strategy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.collectionJob.findUnique.mockResolvedValue({ status: 'running' });
    mockPrisma.collectionJob.update.mockResolvedValue({});
    mockPrisma.thumbnail.upsert.mockResolvedValue({});
    mockPrisma.user.upsert.mockResolvedValue({});

    // Return 3 completed thumbnails per batch
    mockFetchPlayerThumbnails.mockResolvedValue([
      { targetId: 1, state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/1.png' },
      { targetId: 2, state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/2.png' },
      { targetId: 3, state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/3.png' },
    ]);
  });

  it('processes a small user-range batch and upserts thumbnails', async () => {
    // Access the processor function directly from the mock worker
    const { Worker } = await import('bullmq');
    const MockWorker = Worker as jest.MockedClass<any>;

    createThumbnailWorker();

    // Get the processor that was passed to the Worker constructor
    const processorFn = MockWorker.mock.calls[0]?.[1];
    expect(processorFn).toBeDefined();

    // Build a mock BullMQ job
    const mockJob = {
      id: 'bull-123',
      data: {
        jobId: 'cly1234567890',
        strategy: 'user-range',
        startUserId: 1,
        endUserId: 3,
        batchSize: 100,
        sizes: ['420x420'],
        cropTypes: ['avatar'],
        format: 'png',
        downloadImages: false,
      },
      timestamp: Date.now(),
      updateProgress: jest.fn<any>().mockResolvedValue(undefined),
      opts: { attempts: 3 },
      attemptsMade: 0,
    };

    await processorFn(mockJob);

    // Should have updated job status to running
    expect(mockPrisma.collectionJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'running' }) }),
    );

    // Should have fetched thumbnails
    expect(mockFetchPlayerThumbnails).toHaveBeenCalled();

    // Should have upserted user and thumbnail records
    expect(mockPrisma.user.upsert).toHaveBeenCalled();
    expect(mockPrisma.thumbnail.upsert).toHaveBeenCalled();
  });

  it('marks job as completed in DB after processing', async () => {
    const { Worker } = await import('bullmq');
    const MockWorker = Worker as jest.MockedClass<any>;

    createThumbnailWorker();
    const processorFn = MockWorker.mock.calls[0]?.[1];

    const mockJob = {
      id: 'bull-456',
      data: {
        jobId: 'cly9876543210',
        strategy: 'user-range',
        startUserId: 1,
        endUserId: 1,
        batchSize: 100,
        sizes: ['420x420'],
        cropTypes: ['avatar'],
        format: 'png',
        downloadImages: false,
      },
      timestamp: Date.now(),
      updateProgress: jest.fn<any>().mockResolvedValue(undefined),
      opts: { attempts: 3 },
      attemptsMade: 0,
    };

    await processorFn(mockJob);

    // Last update should set status to 'completed'
    const allUpdateCalls = mockPrisma.collectionJob.update.mock.calls as any[];
    const completedCall = allUpdateCalls.find((call: any) =>
      call[0]?.data?.status === 'completed',
    );
    expect(completedCall).toBeDefined();
  });
});

describe('JobSchemas validation', () => {
  it('validates a valid user-range job schema', async () => {
    const { thumbnailJobSchema } = await import('../../../src/queue/jobSchemas');

    const result = thumbnailJobSchema.safeParse({
      jobId: 'cly1234567890123456789012',
      strategy: 'user-range',
      startUserId: 1,
      endUserId: 100,
      batchSize: 50,
      sizes: ['420x420'],
      cropTypes: ['avatar'],
      format: 'png',
      downloadImages: true,
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid strategy', async () => {
    const { thumbnailJobSchema } = await import('../../../src/queue/jobSchemas');

    const result = thumbnailJobSchema.safeParse({
      jobId: 'cly1234567890123456789012',
      strategy: 'invalid-strategy',
    });

    expect(result.success).toBe(false);
  });

  it('validates game-search job schema', async () => {
    const { thumbnailJobSchema } = await import('../../../src/queue/jobSchemas');

    const result = thumbnailJobSchema.safeParse({
      jobId: 'cly1234567890123456789012',
      strategy: 'game-search',
      keyword: 'Adopt Me',
      limit: 50,
      sizes: ['512x512'],
      downloadImages: false,
    });

    expect(result.success).toBe(true);
  });
});
