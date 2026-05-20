import { type NextRequest } from 'next/server';

import { handleApiRoute, jsonResponse, errorResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/thumbnails/[id] — Retrieve detailed info for a specific thumbnail record
export async function GET(_request: NextRequest, { params }: RouteParams) {
  return handleApiRoute(async () => {
    const id = params.id;
    const thumbnail = await db.thumbnail.findUnique({ where: { id } });

    if (!thumbnail) {
      return errorResponse(`Thumbnail with ID "${id}" not found`, 404);
    }

    return jsonResponse(thumbnail);
  });
}

// DELETE /api/thumbnails/[id] — Remove a thumbnail record from the database
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  return handleApiRoute(async () => {
    const id = params.id;
    const existing = await db.thumbnail.findUnique({ where: { id } });

    if (!existing) {
      return errorResponse(`Thumbnail with ID "${id}" not found`, 404);
    }

    await db.thumbnail.delete({ where: { id } });
    return new Response(null, { status: 204 });
  });
}
