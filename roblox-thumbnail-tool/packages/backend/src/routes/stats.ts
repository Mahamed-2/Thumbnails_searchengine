// =============================================================================
// src/routes/stats.ts — Dataset statistics route
// =============================================================================

import { Router, type Request, type Response } from 'express';
import { db } from '@database/client';

export const statsRouter = Router();

// GET /api/v1/stats
statsRouter.get('/', async (_req: Request, res: Response) => {
  const [
    totalThumbnails,
    uniqueUsers,
    availableSizes,
    jobStats,
    recentActivity,
  ] = await Promise.all([
    db.thumbnail.count(),
    db.thumbnail.groupBy({ by: ['userId'], _count: true }).then((r) => r.length),
    db.thumbnail.groupBy({ by: ['size'] }),
    db.collectionJob.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    db.collectionJob.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        status: true,
        progress: true,
        processedItems: true,
        totalItems: true,
        updatedAt: true,
      },
    }),
  ]);

  res.json({
    thumbnails: {
      total: totalThumbnails,
      uniqueUsers,
      sizes: availableSizes.map((s) => s.size),
    },
    jobs: {
      byStatus: Object.fromEntries(jobStats.map((j) => [j.status, j._count.id])),
    },
    recentActivity,
    generatedAt: new Date().toISOString(),
  });
});
