import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis/cloudflare';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Initialize Edge-compatible Upstash Redis and Ratelimit clients
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        Number(process.env.RATE_LIMIT_MAX ?? '60'), // Default 60 requests
        '1 m' // Per 1 minute window
      ),
      analytics: true,
      prefix: 'roblox-thumbnail-tool:ratelimit',
    })
  : null;

/**
 * Extracts client IP securely supporting Vercel forwarded headers
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? '127.0.0.1';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Exclude non-API routes and cron crawler routes
  if (!pathname.startsWith('/api') || pathname.startsWith('/api/cron')) {
    return NextResponse.next();
  }

  // 2. Enforce API Key validation if API_KEY is set in environment
  const expectedApiKey = process.env.API_KEY;
  if (expectedApiKey) {
    const authHeader = request.headers.get('authorization');
    const xApiKey = request.headers.get('x-api-key');

    let token = '';
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (xApiKey) {
      token = xApiKey;
    }

    if (token !== expectedApiKey) {
      return new NextResponse(
        JSON.stringify({
          error: 'Unauthorized: Invalid API Key',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // 3. Apply Sliding Window Rate Limiting via Upstash Redis
  if (ratelimit) {
    const identifier = getClientIp(request);
    try {
      const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

      if (!success) {
        const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
        return new NextResponse(
          JSON.stringify({
            error: 'Too Many Requests',
            limit,
            remaining,
            reset: new Date(reset).toISOString(),
            timestamp: new Date().toISOString(),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            },
          }
        );
      }

      // Add rate limit metadata to response headers
      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Limit', limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', reset.toString());
      return response;
    } catch (error) {
      console.error('Rate limiting error occurred:', error);
      // Fail-open for safety to ensure client queries aren't disrupted by connectivity issues
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
