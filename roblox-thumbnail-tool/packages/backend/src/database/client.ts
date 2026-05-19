// =============================================================================
// src/database/client.ts — Prisma client singleton
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { env } from '@config/env';
import { createLogger } from '@observability/logger';

const logger = createLogger('database');

declare global {
  // Prevent multiple Prisma Client instances in development (HMR)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const db: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ]
        : [{ level: 'warn', emit: 'stdout' }],
  });

if (env.NODE_ENV === 'development') {
  globalThis.__prisma = db;

  // Log slow queries in development
  // Use type assertion to access $on since it's typed with overloads
  void (db as unknown as { $on: (event: string, cb: (e: { query: string; duration: number }) => void) => void })
    .$on('query', (e) => {
      if (e.duration > 100) {
        logger.warn({ query: e.query, duration: e.duration }, '⚠️  Slow query detected');
      }
    });
}

export async function connectDatabase(): Promise<void> {
  try {
    await db.$connect();
    logger.info({ url: env.DATABASE_URL.replace(/:([^@]+)@/, ':***@') }, '🗄️  Database connected');
  } catch (error) {
    logger.error({ error }, '❌ Database connection failed');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await db.$disconnect();
    logger.info('🗄️  Database disconnected');
  } catch (error) {
    logger.error({ error }, '❌ Database disconnect failed');
    throw error;
  }
}
