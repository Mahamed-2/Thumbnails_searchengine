// =============================================================================
// src/routes/health.ts — Health & Readiness endpoints
// =============================================================================

import { Router, type Request, type Response } from 'express';
import { db } from '@database/client';
import { getRedisConnection } from '@queue/redis';
import { createLogger } from '@observability/logger';

const logger = createLogger('health');
export const healthRouter = Router();

interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }>;
}

healthRouter.get('/', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = {};
  let overallStatus: HealthStatus['status'] = 'ok';

  // ── Database Check ─────────────────────────────────────
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks['database'] = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err) {
    logger.error({ err }, 'Health check: database failed');
    checks['database'] = { status: 'error', error: String(err) };
    overallStatus = 'unhealthy';
  }

  // ── Redis Check ────────────────────────────────────────
  try {
    const redisStart = Date.now();
    const redis = getRedisConnection();
    await redis.ping();
    checks['redis'] = { status: 'ok', latencyMs: Date.now() - redisStart };
  } catch (err) {
    logger.error({ err }, 'Health check: Redis failed');
    checks['redis'] = { status: 'error', error: String(err) };
    overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  const health: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env['npm_package_version'] ?? '0.0.0',
    checks,
  };

  const statusCode = overallStatus === 'ok' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Kubernetes readiness probe (stricter — requires all deps)
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    await db.$queryRaw`SELECT 1`;
    const redis = getRedisConnection();
    await redis.ping();
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});
