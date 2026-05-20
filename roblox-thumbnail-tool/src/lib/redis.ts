import { Redis } from '@upstash/redis';

const getRedisClient = (): Redis | null => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('⚠️ Upstash Redis credentials not configured. Queue and locks will be bypassed.');
    return null;
  }

  return new Redis({ url, token });
};

export const redis = getRedisClient();
