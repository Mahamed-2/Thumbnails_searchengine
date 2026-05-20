import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      ...headers,
    },
  });
}

export function errorResponse(message: string, status = 500, details?: unknown) {
  return jsonResponse(
    {
      error: message,
      ...(details !== undefined && { details }),
      timestamp: new Date().toISOString(),
    },
    status
  );
}

export async function handleApiRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    console.error('API Route Error:', error);

    if (error instanceof ZodError) {
      return errorResponse('Validation Error', 400, error.errors);
    }

    if (error instanceof Error) {
      const message = error.message;
      if (message.toLowerCase().includes('not found')) {
        return errorResponse(message, 404);
      }
      return errorResponse(message, 500);
    }

    return errorResponse('An unexpected error occurred', 500);
  }
}
