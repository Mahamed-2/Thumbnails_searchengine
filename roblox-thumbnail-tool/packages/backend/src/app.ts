// =============================================================================
// src/app.ts — Express Application Factory
// =============================================================================

import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';

import { env } from '@config/env';
import { createLogger } from '@observability/logger';
import { healthRouter } from './routes/health';
import { thumbnailsRouter } from './routes/thumbnails';
import { jobsRouter } from './routes/jobs';
import { statsRouter } from './routes/stats';
import { exportRouter } from './routes/export';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { eventsRouter } from './routes/events';
import { setupSwagger } from './swagger';

const logger = createLogger('app');

export function createApp(): Application {
  const app = express();

  // ── Trust proxy (for rate limiting behind load balancer) ──
  app.set('trust proxy', 1);

  // ── Security Headers ──────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── CORS ──────────────────────────────────────────────────
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS policy violation: ${origin}`));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      credentials: true,
    }),
  );

  // ── Body Parsing ──────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // ── Request ID ───────────────────────────────────────────
  app.use(requestId);

  // ── Structured HTTP Logging ───────────────────────────────
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} ${res.statusCode}`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,
    }),
  );

  // ── Global Rate Limiting ──────────────────────────────────
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later.' },
    }),
  );

  // ── Routes ────────────────────────────────────────────────
  setupSwagger(app);
  app.use('/health', healthRouter);
  app.use('/ready', healthRouter);
  app.use('/api/v1/thumbnails', thumbnailsRouter);
  app.use('/api/v1/jobs', jobsRouter);
  app.use('/api/v1/stats', statsRouter);
  app.use('/api/v1/export', exportRouter);
  app.use('/api/v1/events', eventsRouter);

  // ── 404 Handler ───────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found', path: _req.path });
  });

  // ── Global Error Handler ──────────────────────────────────
  app.use(errorHandler);

  return app;
}
