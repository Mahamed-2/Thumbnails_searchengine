// =============================================================================
// src/routes/export.ts — Dataset export route (Phase 5+)
// =============================================================================

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '@database/client';

export const exportRouter = Router();

const exportSchema = z.object({
  name: z.string().max(100).default('export'),
  format: z.enum(['json', 'csv']),
  filters: z
    .object({
      size: z.string().optional(),
      cropType: z.string().optional(),
      format: z.string().optional(),
      fromDate: z.string().datetime().optional(),
      toDate: z.string().datetime().optional(),
    })
    .optional(),
});

// POST /api/v1/export — Request a new dataset export
exportRouter.post('/', async (req: Request, res: Response) => {
  const body = exportSchema.parse(req.body);

  const exportRecord = await db.datasetExport.create({
    data: {
      name: body.name,
      format: body.format,
      filters: JSON.stringify(body.filters ?? {}),
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });

  // TODO (Phase 5): enqueue export job to BullMQ

  res.status(202).json({
    message: 'Export queued',
    exportId: exportRecord.id,
    estimatedReady: '< 2 minutes',
  });
});

// GET /api/v1/export/:id/status
exportRouter.get('/:id/status', async (req: Request, res: Response) => {
  const id = req.params['id']!;
  const record = await db.datasetExport.findUnique({ where: { id } });
  if (!record) {
    res.status(404).json({ error: 'Export not found' });
    return;
  }
  res.json(record);
});
