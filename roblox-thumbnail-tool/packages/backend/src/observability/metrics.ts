// =============================================================================
// src/observability/metrics.ts — Prometheus metrics
// =============================================================================

import { createServer } from 'http';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
  type LabelValues,
} from 'prom-client';
import { createLogger } from './logger';

const logger = createLogger('metrics');

// Use a dedicated registry (avoids default singleton conflicts in tests)
export const metricsRegistry = new Registry();

// Collect Node.js default metrics (CPU, memory, GC, event loop lag)
collectDefaultMetrics({ register: metricsRegistry, prefix: 'roblox_' });

// ── API Metrics ────────────────────────────────────────────────────────────────
export const httpRequestDuration = new Histogram({
  name: 'roblox_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

export const httpRequestTotal = new Counter({
  name: 'roblox_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

// ── Queue Metrics ──────────────────────────────────────────────────────────────
export const queueJobsTotal = new Counter({
  name: 'roblox_queue_jobs_total',
  help: 'Total number of queue jobs processed',
  labelNames: ['queue', 'status'],
  registers: [metricsRegistry],
});

export const queueDepth = new Gauge({
  name: 'roblox_queue_depth',
  help: 'Current number of jobs waiting in queue',
  labelNames: ['queue'],
  registers: [metricsRegistry],
});

export const queueJobDuration = new Histogram({
  name: 'roblox_queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue', 'status'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

// ── Pipeline Metrics ───────────────────────────────────────────────────────────
export const thumbnailsCollected = new Counter({
  name: 'roblox_thumbnails_collected_total',
  help: 'Total number of thumbnails successfully collected',
  labelNames: ['crop_type', 'size'],
  registers: [metricsRegistry],
});

export const thumbnailsDuplicate = new Counter({
  name: 'roblox_thumbnails_duplicate_total',
  help: 'Total number of duplicate thumbnails detected and skipped',
  registers: [metricsRegistry],
});

export const thumbnailsFailed = new Counter({
  name: 'roblox_thumbnails_failed_total',
  help: 'Total number of thumbnail collection failures',
  labelNames: ['reason'],
  registers: [metricsRegistry],
});

export const storageUsedBytes = new Gauge({
  name: 'roblox_storage_used_bytes',
  help: 'Total storage used for images in bytes',
  registers: [metricsRegistry],
});

export const robloxApiRequests = new Counter({
  name: 'roblox_api_requests_total',
  help: 'Total number of Roblox API requests made',
  labelNames: ['endpoint', 'status'],
  registers: [metricsRegistry],
});

export const robloxApiRateLimitHits = new Counter({
  name: 'roblox_api_rate_limit_hits_total',
  help: 'Total number of Roblox API rate limit responses (429)',
  registers: [metricsRegistry],
});

// ── Convenience helpers ────────────────────────────────────────────────────────
type HistogramLabels = LabelValues<string>;

export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number,
): void {
  const labels = { method, route, status_code: String(statusCode) } satisfies HistogramLabels;
  httpRequestDuration.observe(labels, durationSeconds);
  httpRequestTotal.inc(labels);
}

// ── Metrics HTTP Server ────────────────────────────────────────────────────────
export async function startMetricsServer(port: number): Promise<void> {
  const server = createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', metricsRegistry.contentType);
      res.end(await metricsRegistry.metrics());
    } else {
      res.writeHead(404).end('Not Found');
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, () => {
      logger.info({ port }, '📊 Prometheus metrics server started');
      resolve();
    });
    server.on('error', reject);
  });
}
