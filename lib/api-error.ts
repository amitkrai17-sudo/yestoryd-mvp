// lib/api-error.ts
// Standardized API error handling for all routes

import { NextResponse } from 'next/server';

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Standard error codes for consistent client handling
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Wrap API handlers with consistent error handling
export function withErrorHandler(
  handler: (request: Request) => Promise<NextResponse>
) {
  return async (request: Request): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      console.error('API Error:', error);

      if (error instanceof APIError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
          },
          { status: error.statusCode }
        );
      }

      // Supabase errors
      if (error && typeof error === 'object' && 'code' in error) {
        const supabaseError = error as { code: string; message: string };
        return NextResponse.json(
          {
            error: 'Database operation failed',
            code: ErrorCodes.DATABASE_ERROR,
            details: supabaseError.message,
          },
          { status: 500 }
        );
      }

      // Generic errors
      return NextResponse.json(
        {
          error: 'An unexpected error occurred',
          code: ErrorCodes.INTERNAL_ERROR,
        },
        { status: 500 }
      );
    }
  };
}

// Helper functions for common errors
export function notFound(message = 'Resource not found') {
  throw new APIError(message, 404, ErrorCodes.NOT_FOUND);
}

export function badRequest(message: string) {
  throw new APIError(message, 400, ErrorCodes.VALIDATION_ERROR);
}

export function unauthorized(message = 'Authentication required') {
  throw new APIError(message, 401, ErrorCodes.UNAUTHORIZED);
}

export function forbidden(message = 'Access denied') {
  throw new APIError(message, 403, ErrorCodes.FORBIDDEN);
}

export function rateLimited(message = 'Too many requests') {
  throw new APIError(message, 429, ErrorCodes.RATE_LIMITED);
}

// Usage example in API route:
/*
import { withErrorHandler, badRequest, notFound } from '@/lib/api-error';

export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  
  if (!body.childId) {
    badRequest('Child ID is required');
  }
  
  const child = await getChild(body.childId);
  if (!child) {
    notFound('Child not found');
  }
  
  return NextResponse.json({ success: true, data: child });
});
*/
