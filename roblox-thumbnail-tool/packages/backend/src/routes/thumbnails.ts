// =============================================================================
// src/routes/thumbnails.ts — Thumbnail collection & retrieval routes (Phase 2+)
// =============================================================================

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '@database/client';
import { NotFoundError } from '../middleware/errorHandler';

export const thumbnailsRouter = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  size: z.string().optional(),
  cropType: z.enum(['avatar', 'avatar-bust', 'avatar-headshot']).optional(),
  userId: z.coerce.number().int().optional(),
  format: z.enum(['png', 'jpeg', 'webp']).optional(),
  isDuplicate: z.enum(['true', 'false']).optional(),
});

// GET /api/v1/thumbnails
thumbnailsRouter.get('/', async (req: Request, res: Response) => {
  const query = listQuerySchema.parse(req.query);
  const skip = (query.page - 1) * query.limit;

  const where = {
    ...(query.size && { size: query.size }),
    ...(query.cropType && { cropType: query.cropType }),
    ...(query.userId && { userId: query.userId }),
    ...(query.format && { format: query.format }),
    ...(query.isDuplicate !== undefined && { isDuplicate: query.isDuplicate === 'true' }),
  };

  const [thumbnails, total] = await Promise.all([
    db.thumbnail.findMany({ where, skip, take: query.limit, orderBy: { collectedAt: 'desc' } }),
    db.thumbnail.count({ where }),
  ]);

  res.json({
    data: thumbnails,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  });
});

// GET /api/v1/thumbnails/:id
thumbnailsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params['id']!;
  const thumbnail = await db.thumbnail.findUnique({ where: { id } });
  if (!thumbnail) throw new NotFoundError('Thumbnail', req.params['id']);
  res.json(thumbnail);
});

// DELETE /api/v1/thumbnails/:id
thumbnailsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params['id']!;
  const existing = await db.thumbnail.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Thumbnail', id);
  await db.thumbnail.delete({ where: { id } });
  res.status(204).end();
});
