// =============================================================================
// tests/integration/api.spec.ts — Integration tests for API routes
// =============================================================================

import request from 'supertest';
import { jest } from '@jest/globals';

// Mock DB and Redis to avoid needing actual services running
jest.mock('../../src/database/client', () => ({
  db: {
    $disconnect: jest.fn<any>(),
    $queryRaw: jest.fn<any>().mockResolvedValue([{ 1: 1 }]),
    thumbnail: { findMany: jest.fn<any>().mockResolvedValue([]), count: jest.fn<any>().mockResolvedValue(0) },
    collectionJob: { create: jest.fn<any>().mockResolvedValue({ id: 'test-job-id' }), findMany: jest.fn<any>().mockResolvedValue([]) },
    user: { count: jest.fn<any>().mockResolvedValue(0) },
    datasetExport: { count: jest.fn<any>().mockResolvedValue(0) }
  }
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn<any>().mockImplementation(() => ({
    add: jest.fn<any>().mockResolvedValue({ id: 'bull-job-123' }),
    getJobCounts: jest.fn<any>().mockResolvedValue({ active: 0, waiting: 0, completed: 0, failed: 0 }),
  })),
  Worker: jest.fn<any>(),
  FlowProducer: jest.fn<any>(),
}));

jest.mock('../../src/queue/redis', () => ({
  createRedisConnection: jest.fn<any>().mockReturnValue({ ping: jest.fn<any>().mockResolvedValue('PONG') }),
  getRedisConnection: jest.fn<any>().mockReturnValue({ ping: jest.fn<any>().mockResolvedValue('PONG') }),
}));

import { createApp } from '../../src/app';
import { db } from '../../src/database/client';

describe('API Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    app = createApp();
    // Run migrations or seed data if necessary for integration tests
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe('GET /health', () => {
    it('returns 200 OK with status and version', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /api/v1/thumbnails', () => {
    it('returns a paginated list of thumbnails', async () => {
      const response = await request(app).get('/api/v1/thumbnails');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/jobs', () => {
    it('validates request payload and creates a job', async () => {
      const response = await request(app)
        .post('/api/v1/jobs')
        .send({
          type: 'thumbnail-collection',
          strategy: 'user-range',
          startUserId: 1,
          endUserId: 10,
          size: '150x150',
          cropType: 'headshot',
          format: 'png',
        });
      
      // We expect 202 Accepted because the job is queued
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('message', 'Job enqueued successfully');
      expect(response.body).toHaveProperty('bullJobId');
    });

    it('returns 400 Bad Request for invalid payload', async () => {
      const response = await request(app)
        .post('/api/v1/jobs')
        .send({
          type: 'thumbnail-collection',
          strategy: 'invalid-strategy',
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
