// =============================================================================
// src/routes/events.ts — Server-Sent Events (SSE) for real-time job progress
// Clients subscribe to a job ID and receive live progress updates.
// =============================================================================

import { Router, type Request, type Response } from 'express';
import { progressEmitter, type ProgressEvent, type JobStatusEvent } from '@workers/progressEmitter';
import { createLogger } from '@observability/logger';

const logger = createLogger('events-route');

export const eventsRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────
function sendSSEData(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function setupSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();
}

// ── GET /api/v1/events/jobs/:jobId — Subscribe to a specific job ──────────────
eventsRouter.get('/jobs/:jobId', (req: Request, res: Response) => {
  const jobId = req.params['jobId']!;

  setupSSEHeaders(res);

  logger.info({ jobId, ip: req.ip }, '🔌 SSE client connected to job');

  // Send initial connection confirmation
  sendSSEData(res, 'connected', { jobId, timestamp: new Date().toISOString() });

  // Keep-alive ping every 15 seconds (prevents proxy timeouts)
  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 15_000);

  const unsubscribe = progressEmitter.subscribeToJob(
    jobId,
    (event: ProgressEvent) => {
      sendSSEData(res, 'progress', event);
    },
    (event: JobStatusEvent) => {
      sendSSEData(res, 'status', event);

      // Auto-close when terminal state reached
      if (['completed', 'failed', 'cancelled'].includes(event.status)) {
        sendSSEData(res, 'done', { jobId, status: event.status });
        res.end();
      }
    },
  );

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
    logger.info({ jobId, ip: req.ip }, '🔌 SSE client disconnected from job');
  });
});

// ── GET /api/v1/events/all — Subscribe to all job events ─────────────────────
eventsRouter.get('/all', (req: Request, res: Response) => {
  setupSSEHeaders(res);

  logger.info({ ip: req.ip }, '🔌 SSE client connected to all-jobs stream');

  sendSSEData(res, 'connected', { stream: 'all', timestamp: new Date().toISOString() });

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15_000);

  const unsubscribe = progressEmitter.subscribeToAll(
    (event: ProgressEvent) => sendSSEData(res, 'progress', event),
    (event: JobStatusEvent) => sendSSEData(res, 'status', event),
  );

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
    logger.info({ ip: req.ip }, '🔌 SSE client disconnected from all-jobs stream');
  });
});

// ── GET /api/v1/events/stats — Server stats (subscriber count) ────────────────
eventsRouter.get('/stats', (_req: Request, res: Response) => {
  res.json({
    subscriberCount: progressEmitter.getSubscriberCount(),
    timestamp: new Date().toISOString(),
  });
});
