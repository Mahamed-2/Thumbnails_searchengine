// =============================================================================
// src/app/api/analytics/timeseries/route.ts
// GET /api/analytics/timeseries?days=7|14|30
// Returns daily thumbnail collection counts for trend charts.
// =============================================================================

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiRoute, jsonResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

export async function GET(request: NextRequest) {
  return handleApiRoute(async () => {
    const { searchParams } = new URL(request.url);
    const { days } = querySchema.parse(Object.fromEntries(searchParams));

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    // Aggregate thumbnails by day using a raw SQL GROUP BY DATE
    const rows = await db.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT
        DATE_TRUNC('day', "collected_at") AS day,
        COUNT(*)::bigint                  AS count
      FROM thumbnails
      WHERE "collected_at" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    // Fill missing days with 0
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.day.toISOString().slice(0, 10), Number(row.count));
    }

    const series: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: map.get(key) ?? 0 });
    }

    // Also get job status timeseries for the same window
    const jobRows = await db.$queryRaw<{ day: Date; status: string; count: bigint }[]>`
      SELECT
        DATE_TRUNC('day', "created_at") AS day,
        status,
        COUNT(*)::bigint                AS count
      FROM collection_jobs
      WHERE "created_at" >= ${since}
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `;

    const jobsByDay: Record<string, Record<string, number>> = {};
    for (const row of jobRows) {
      const key = row.day.toISOString().slice(0, 10);
      if (!jobsByDay[key]) jobsByDay[key] = {};
      jobsByDay[key][row.status] = Number(row.count);
    }

    return jsonResponse({
      thumbnails: series,
      jobs:       jobsByDay,
      period:     { days, since: since.toISOString() },
      generatedAt: new Date().toISOString(),
    });
  });
}
