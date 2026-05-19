// =============================================================================
// src/observability/logger.ts — Structured JSON logger (Pino)
// =============================================================================

import pino, { type Logger } from 'pino';
import { env } from '@config/env';

const devTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  },
};

const baseLogger = pino({
  level: env.APP_LOG_LEVEL,
  ...(env.NODE_ENV === 'development' ? { transport: devTransport } : {}),

  base: {
    env: env.NODE_ENV,
    service: 'roblox-thumbnail-tool',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.secret',
      '*.apiKey',
      '*.apiSecret',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * Creates a child logger with a component label for contextual tracing.
 */
export function createLogger(component: string): Logger {
  return baseLogger.child({ component });
}

export { baseLogger as logger };
export type { Logger };
