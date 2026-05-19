// =============================================================================
// src/workers/progressEmitter.ts — Real-time job progress via EventEmitter
// Used by workers to push SSE updates to connected dashboard clients.
// =============================================================================

import { EventEmitter } from 'events';
import { createLogger } from '@observability/logger';
import type { JobProgress } from '@queue/jobSchemas';

const logger = createLogger('progress-emitter');

export interface ProgressEvent {
  jobId: string;
  bullJobId?: string;
  progress: JobProgress;
  timestamp: string;
}

export interface JobStatusEvent {
  jobId: string;
  status: 'started' | 'completed' | 'failed' | 'cancelled' | 'paused';
  error?: string;
  timestamp: string;
}

class ProgressEmitter extends EventEmitter {
  private readonly subscribers = new Map<string, Set<(event: ProgressEvent) => void>>();
  private readonly statusSubscribers = new Map<string, Set<(event: JobStatusEvent) => void>>();

  constructor() {
    super();
    this.setMaxListeners(500); // Support many concurrent SSE connections
  }

  // ── Progress Updates ─────────────────────────────────────────────────────────
  emitProgress(jobId: string, progress: JobProgress, bullJobId?: string): void {
    const event: ProgressEvent = {
      jobId,
      ...(bullJobId ? { bullJobId } : {}),
      progress,
      timestamp: new Date().toISOString(),
    };

    this.emit(`progress:${jobId}`, event);
    this.emit('progress:*', event); // Wildcard for dashboard overview

    logger.debug(
      { jobId, percentage: progress.percentage, phase: progress.phase },
      '📊 Progress update emitted',
    );
  }

  // ── Job Status Events ────────────────────────────────────────────────────────
  emitStatus(jobId: string, status: JobStatusEvent['status'], error?: string): void {
    const event: JobStatusEvent = {
      jobId,
      status,
      ...(error ? { error } : {}),
      timestamp: new Date().toISOString(),
    };

    this.emit(`status:${jobId}`, event);
    this.emit('status:*', event);

    logger.info({ jobId, status, error }, '🔔 Job status event emitted');
  }

  // ── Subscription Helpers ─────────────────────────────────────────────────────
  subscribeToJob(
    jobId: string,
    onProgress: (event: ProgressEvent) => void,
    onStatus: (event: JobStatusEvent) => void,
  ): () => void {
    this.on(`progress:${jobId}`, onProgress);
    this.on(`status:${jobId}`, onStatus);

    // Track subscriptions per job
    if (!this.subscribers.has(jobId)) this.subscribers.set(jobId, new Set());
    if (!this.statusSubscribers.has(jobId)) this.statusSubscribers.set(jobId, new Set());
    this.subscribers.get(jobId)!.add(onProgress);
    this.statusSubscribers.get(jobId)!.add(onStatus);

    logger.debug({ jobId }, '🔌 SSE client subscribed to job');

    // Return unsubscribe function
    return () => {
      this.off(`progress:${jobId}`, onProgress);
      this.off(`status:${jobId}`, onStatus);
      this.subscribers.get(jobId)?.delete(onProgress);
      this.statusSubscribers.get(jobId)?.delete(onStatus);
      logger.debug({ jobId }, '🔌 SSE client unsubscribed from job');
    };
  }

  subscribeToAll(
    onProgress: (event: ProgressEvent) => void,
    onStatus: (event: JobStatusEvent) => void,
  ): () => void {
    this.on('progress:*', onProgress);
    this.on('status:*', onStatus);

    return () => {
      this.off('progress:*', onProgress);
      this.off('status:*', onStatus);
    };
  }

  getSubscriberCount(jobId?: string): number {
    if (jobId) {
      return this.listenerCount(`progress:${jobId}`);
    }
    return this.listenerCount('progress:*');
  }
}

// Singleton — shared across workers and route handlers
export const progressEmitter = new ProgressEmitter();
