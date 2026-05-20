import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

// GET /api/health — System health check for Vercel/Monitoring
export async function GET() {
  const startTime = Date.now();
  
  try {
    // 1. Check Database
    await db.$queryRaw`SELECT 1`;
    
    // 2. Check Redis (if configured)
    if (redis) {
      await redis.ping();
    }
    
    return NextResponse.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: redis ? 'connected' : 'disabled',
      },
      latency: `${Date.now() - startTime}ms`,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      latency: `${Date.now() - startTime}ms`,
    }, { status: 503 });
  }
}
