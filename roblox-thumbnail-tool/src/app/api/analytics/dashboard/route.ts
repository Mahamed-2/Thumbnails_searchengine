import { handleApiRoute, jsonResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';

// GET /api/analytics/dashboard — Fetch system metrics and job aggregates
export async function GET() {
  return handleApiRoute(async () => {
    const [
      totalThumbnails,
      uniqueUsers,
      availableSizes,
      jobStats,
      recentActivity,
    ] = await Promise.all([
      db.thumbnail.count(),
      // Grouping by userId to count unique Roblox users with collected thumbnails
      db.thumbnail.groupBy({ by: ['userId'] }).then((r) => r.length),
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

    return jsonResponse({
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
}
