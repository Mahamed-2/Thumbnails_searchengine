import { type NextRequest } from 'next/server';

import { handleApiRoute, jsonResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { enqueueJob } from '@/lib/queue';

export async function GET(request: NextRequest) {
  return handleApiRoute(async () => {
    // Verify Vercel Cron signature in production
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const now = new Date();

    // 1. Clean up expired dataset exports
    const deletedExports = await db.datasetExport.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    // 2. Clean up historical crawl jobs older than 14 days
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const deletedJobs = await db.collectionJob.deleteMany({
      where: {
        status: { in: ['completed', 'failed', 'cancelled'] },
        updatedAt: { lt: fourteenDaysAgo },
      },
    });

    // 3. Stalled Job Recovery
    // Any job marked "running" but not updated in the last 15 minutes is likely stalled (e.g. crashed worker)
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const stalledJobs = await db.collectionJob.findMany({
      where: {
        status: 'running',
        updatedAt: { lt: fifteenMinutesAgo },
      },
    });

    for (const job of stalledJobs) {
      await db.collectionJob.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          errorLog: 'Job was automatically recovered from a stalled/crashed state.',
        },
      });

      // Re-enqueue in Redis queue
      await enqueueJob(job.id);
    }

    return jsonResponse({
      cleanup: {
        deletedExports: deletedExports.count,
        deletedJobs: deletedJobs.count,
        recoveredStalledJobs: stalledJobs.length,
      },
      timestamp: now.toISOString(),
    });
  });
}
