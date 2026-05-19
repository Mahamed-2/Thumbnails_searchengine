// =============================================================================
// src/index.ts — Application Entry Point
// Bootstraps Express server, BullMQ workers, and graceful shutdown.
// =============================================================================

import 'dotenv/config';
import 'express-async-errors';

import { env } from '@config/env';
import { createApp } from './app';
import { createLogger } from '@observability/logger';
import { connectDatabase } from '@database/client';
import { connectRedis } from '@queue/redis';
import { startWorkers } from '@workers/index';
import { startMetricsServer } from '@observability/metrics';
import { createServer } from 'http';

const logger = createLogger('bootstrap');

async function bootstrap() {
  logger.info({ env: env.NODE_ENV, port: env.APP_PORT }, '🚀 Starting Roblox Thumbnail Tool...');

  // 1. Validate & connect database
  await connectDatabase();
  logger.info('✅ Database connected');

  // 2. Connect Redis
  await connectRedis();
  logger.info('✅ Redis connected');

  // 3. Create Express app
  const app = createApp();
  const httpServer = createServer(app);

  // 4. Start BullMQ workers
  await startWorkers();
  logger.info('✅ Queue workers started');

  // 5. Start metrics server (separate port)
  if (env.METRICS_ENABLED) {
    await startMetricsServer(env.METRICS_PORT);
    logger.info({ port: env.METRICS_PORT }, '✅ Metrics server started');
  }

  // 6. Start HTTP server
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(env.APP_PORT, env.APP_HOST, () => {
      logger.info(
        { host: env.APP_HOST, port: env.APP_PORT },
        `✅ HTTP server listening on http://${env.APP_HOST}:${env.APP_PORT}`,
      );
      resolve();
    });
    httpServer.on('error', reject);
  });

  // 7. Register graceful shutdown
  registerGracefulShutdown(httpServer);
}

function registerGracefulShutdown(server: ReturnType<typeof createServer>) {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, '📴 Received shutdown signal — draining gracefully...');

    // Stop accepting new connections
    server.close(async () => {
      try {
        const { disconnectDatabase } = await import('@database/client');
        const { disconnectRedis } = await import('@queue/redis');
        const { stopWorkers } = await import('@workers/index');

        await stopWorkers();
        await disconnectDatabase();
        await disconnectRedis();

        logger.info('✅ Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, '❌ Error during shutdown');
        process.exit(1);
      }
    });

    // Force exit after 30s if graceful shutdown stalls
    setTimeout(() => {
      logger.error('⚠️  Forced shutdown after timeout');
      process.exit(1);
    }, 30_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, '💥 Unhandled Promise Rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, '💥 Uncaught Exception');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Fatal bootstrap error:', err);
  process.exit(1);
});
