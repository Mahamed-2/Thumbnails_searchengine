import { PrismaClient } from '@prisma/client';

declare global {
  // Prevent multiple Prisma Client instances in development (HMR)
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const db =
  globalThis.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ]
        : [{ level: 'error', emit: 'stdout' }],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db;
}

// Log slow queries in development
if (process.env.NODE_ENV === 'development') {
  void (db as unknown as { $on: (event: string, cb: (e: { query: string; duration: number }) => void) => void })
    .$on('query', (e) => {
      if (e.duration > 150) {
        console.warn(`⚠️ Slow query (${e.duration}ms): ${e.query}`);
      }
    });
}
