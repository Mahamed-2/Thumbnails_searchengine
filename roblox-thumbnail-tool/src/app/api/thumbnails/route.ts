import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiRoute, jsonResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { enqueueJob } from '@/lib/queue';

// GET Filter Validation Schema
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  size: z.string().optional(),
  cropType: z.enum(['avatar', 'avatar-bust', 'avatar-headshot']).optional(),
  userId: z.coerce.number().int().optional(),
  format: z.enum(['png', 'jpeg', 'webp']).optional(),
  isDuplicate: z.enum(['true', 'false']).optional(),
});

// POST Start Collection Schema
const startCollectionSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1).max(100),
  size: z.string().default('420x420'),
  cropType: z.enum(['avatar', 'avatar-bust', 'avatar-headshot']).default('avatar'),
  format: z.enum(['png', 'jpeg', 'webp']).default('png'),
});

// GET /api/thumbnails — Retrieve paginated thumbnail list
export async function GET(request: NextRequest) {
  return handleApiRoute(async () => {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const query = listQuerySchema.parse(params);
    const skip = (query.page - 1) * query.limit;

    const where = {
      ...(query.size && { size: query.size }),
      ...(query.cropType && { cropType: query.cropType }),
      ...(query.userId && { userId: query.userId }),
      ...(query.format && { format: query.format }),
      ...(query.isDuplicate !== undefined && { isDuplicate: query.isDuplicate === 'true' }),
    };

    const [thumbnails, total] = await Promise.all([
      db.thumbnail.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { collectedAt: 'desc' },
      }),
      db.thumbnail.count({ where }),
    ]);

    return jsonResponse({
      data: thumbnails,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    });
  });
}

// POST /api/thumbnails — Request collection of thumbnails for specific users
export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    const body = await request.json();
    const payload = startCollectionSchema.parse(body);

    // Create a CollectionJob track record
    const job = await db.collectionJob.create({
      data: {
        name: `Quick Collect: ${payload.userIds.length} users`,
        status: 'pending',
        strategy: 'user-range',
        config: JSON.stringify({
          startUserId: Math.min(...payload.userIds),
          endUserId: Math.max(...payload.userIds),
          sizes: [payload.size],
          cropTypes: [payload.cropType],
          format: payload.format,
          userIds: payload.userIds,
        }),
        totalItems: payload.userIds.length,
      },
    });

    // Enqueue the quick collect job to the Redis queue
    await enqueueJob(job.id);

    return jsonResponse(
      {
        message: 'Collection job successfully created and enqueued',
        jobId: job.id,
        status: job.status,
      },
      202
    );
  });
}
