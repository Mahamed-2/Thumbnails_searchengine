import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiRoute, jsonResponse, errorResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/collections/[id]/status — Fetch status of a collection job
export async function GET(_request: NextRequest, { params }: RouteParams) {
  return handleApiRoute(async () => {
    const id = params.id;
    const job = await db.collectionJob.findUnique({
      where: { id },
      include: {
        _count: { select: { thumbnails: true, dlqEntries: true } },
      },
    });

    if (!job) {
      return errorResponse(`Collection job with ID "${id}" not found`, 404);
    }

    return jsonResponse(job);
  });
}

const actionSchema = z.object({
  action: z.enum(['cancel', 'retry']),
});

// POST /api/collections/[id]/status — Trigger actions (cancel / retry) on a collection job
export async function POST(request: NextRequest, { params }: RouteParams) {
  return handleApiRoute(async () => {
    const id = params.id;
    const body = await request.json();
    const { action } = actionSchema.parse(body);

    const existingJob = await db.collectionJob.findUnique({ where: { id } });
    if (!existingJob) {
      return errorResponse(`Collection job with ID "${id}" not found`, 404);
    }

    if (action === 'cancel') {
      if (!['pending', 'running'].includes(existingJob.status)) {
        return errorResponse(`Cannot cancel job in status '${existingJob.status}'`, 409);
      }

      const updated = await db.collectionJob.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      return jsonResponse({
        message: 'Cancellation requested successfully',
        job: updated,
      });
    }

    if (action === 'retry') {
      if (existingJob.status !== 'failed' && existingJob.status !== 'cancelled') {
        return errorResponse(`Cannot retry job in status '${existingJob.status}'`, 409);
      }

      const updated = await db.collectionJob.update({
        where: { id },
        data: {
          status: 'pending',
          progress: 0,
          processedItems: 0,
          successItems: 0,
          failedItems: 0,
          startedAt: null,
          completedAt: null,
          errorLog: null,
        },
      });

      // Note: Redis queue re-enqueueing will be integrated in Phase 4.
      return jsonResponse({
        message: 'Job successfully re-queued',
        job: updated,
      });
    }

    return errorResponse('Invalid job status control action', 400);
  });
}
