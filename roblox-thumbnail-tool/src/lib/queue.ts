import { redis } from './redis';

const QUEUE_KEY = 'roblox:queue:jobs';
const LOCK_PREFIX = 'roblox:lock:job:';

/**
 * Enqueues a job ID to the Upstash FIFO queue.
 */
export async function enqueueJob(jobId: string): Promise<number | null> {
  if (!redis) return null;
  return await redis.rpush(QUEUE_KEY, jobId);
}

/**
 * Pops the next job ID from the Upstash FIFO queue.
 */
export async function getNextJob(): Promise<string | null> {
  if (!redis) return null;
  return await redis.lpop(QUEUE_KEY);
}

/**
 * Acquires a distributed lock on a job to prevent concurrent processing.
 * Returns true if the lock was acquired, false if it is already locked.
 */
export async function acquireLock(jobId: string, ttlSeconds = 60): Promise<boolean> {
  if (!redis) return true; // Bypass lock in local dev without Upstash Redis configured
  const lockKey = `${LOCK_PREFIX}${jobId}`;
  const result = await redis.set(lockKey, 'locked', { nx: true, ex: ttlSeconds });
  return result === 'OK';
}

/**
 * Refreshes an existing lock's TTL to prevent expiry during long operations.
 */
export async function refreshLock(jobId: string, ttlSeconds = 60): Promise<void> {
  if (!redis) return;
  const lockKey = `${LOCK_PREFIX}${jobId}`;
  await redis.expire(lockKey, ttlSeconds);
}

/**
 * Explicitly releases a job's distributed lock.
 */
export async function releaseLock(jobId: string): Promise<void> {
  if (!redis) return;
  const lockKey = `${LOCK_PREFIX}${jobId}`;
  await redis.del(lockKey);
}
