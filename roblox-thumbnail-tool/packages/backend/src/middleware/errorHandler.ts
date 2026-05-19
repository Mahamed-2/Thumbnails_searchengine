// =============================================================================
// src/middleware/errorHandler.ts — Global Express error handler
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { createLogger } from '@observability/logger';

const logger = createLogger('error-handler');

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public override readonly message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, `${resource}${id ? ` '${id}'` : ''} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(source = 'API') {
    super(429, `Rate limit exceeded for ${source}`, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string | undefined;

  // ── AppError (our own structured errors) ──
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, `[${err.code}] ${err.message}`);
    } else {
      logger.warn({ err, requestId }, `[${err.code}] ${err.message}`);
    }

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
      requestId,
    });
    return;
  }

  // ── Zod Validation Errors ──────────────────
  if (err instanceof ZodError) {
    logger.warn({ errors: err.flatten(), requestId }, 'Validation error');
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
      requestId,
    });
    return;
  }

  // ── Prisma Errors ─────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: 'Resource already exists',
        code: 'CONFLICT',
        requestId,
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: 'Resource not found',
        code: 'NOT_FOUND',
        requestId,
      });
      return;
    }
  }

  // ── Unknown Errors ─────────────────────────
  logger.error({ err, requestId }, '💥 Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId,
  });
}
