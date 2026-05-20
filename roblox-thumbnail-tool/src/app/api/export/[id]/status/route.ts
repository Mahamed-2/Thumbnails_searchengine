import { type NextRequest } from 'next/server';

import { handleApiRoute, jsonResponse, errorResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/export/[id]/status — Check the status of a dataset export job
export async function GET(_request: NextRequest, { params }: RouteParams) {
  return handleApiRoute(async () => {
    const id = params.id;
    const record = await db.datasetExport.findUnique({ where: { id } });

    if (!record) {
      return errorResponse(`Export task with ID "${id}" not found`, 404);
    }

    return jsonResponse(record);
  });
}
