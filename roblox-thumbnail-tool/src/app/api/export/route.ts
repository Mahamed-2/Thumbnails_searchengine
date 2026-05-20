import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiRoute, jsonResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';

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

// POST /api/export — Request a dataset export task
export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    const body = await request.json();
    const validated = exportSchema.parse(body);

    const exportRecord = await db.datasetExport.create({
      data: {
        name: validated.name,
        format: validated.format,
        filters: JSON.stringify(validated.filters ?? {}),
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
      },
    });

    // Note: Upstash Redis export workflow trigger will be wired in Phase 4.
    return jsonResponse(
      {
        message: 'Export job successfully queued',
        exportId: exportRecord.id,
        estimatedReady: '< 2 minutes',
      },
      202
    );
  });
}
