/**
 * Error Handling Utilities
 * 
 * Standardized error handling for API routes
 * Provides consistent error responses and logging
 * 
 * Usage:
 * import { handleApiError, ApiError, withErrorHandling } from '@/lib/errors';
 */

import { NextResponse } from 'next/server';

// ==================== ERROR CODES ====================

export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Database
  DB_ERROR: 'DB_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  
  // External Services
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  CALENDAR_ERROR: 'CALENDAR_ERROR',
  EMAIL_ERROR: 'EMAIL_ERROR',
  WHATSAPP_ERROR: 'WHATSAPP_ERROR',
  
  // Rate Limiting
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ==================== CUSTOM ERROR CLASS ====================

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
    };
  }
}

// ==================== ERROR FACTORY FUNCTIONS ====================

export const Errors = {
  unauthorized: (message = 'Unauthorized') =>
    new ApiError(message, ErrorCodes.UNAUTHORIZED, 401),

  forbidden: (message = 'Forbidden') =>
    new ApiError(message, ErrorCodes.FORBIDDEN, 403),

  notFound: (resource = 'Resource') =>
    new ApiError(`${resource} not found`, ErrorCodes.NOT_FOUND, 404),

  validation: (message: string, details?: Record<string, any>) =>
    new ApiError(message, ErrorCodes.VALIDATION_ERROR, 400, details),

  missingField: (field: string) =>
    new ApiError(`Missing required field: ${field}`, ErrorCodes.MISSING_REQUIRED_FIELD, 400),

  database: (message: string, details?: Record<string, any>) =>
    new ApiError(message, ErrorCodes.DB_ERROR, 500, details),

  aiProvider: (message: string, details?: Record<string, any>) =>
    new ApiError(message, ErrorCodes.AI_PROVIDER_ERROR, 503, details),

  payment: (message: string, details?: Record<string, any>) =>
    new ApiError(message, ErrorCodes.PAYMENT_ERROR, 502, details),

  calendar: (message: string, details?: Record<string, any>) =>
    new ApiError(message, ErrorCodes.CALENDAR_ERROR, 502, details),

  rateLimited: (retryAfter?: number) =>
    new ApiError(
      'Too many requests. Please try again later.',
      ErrorCodes.RATE_LIMITED,
      429,
      retryAfter ? { retryAfter } : undefined
    ),

  internal: (message = 'Internal server error') =>
    new ApiError(message, ErrorCodes.INTERNAL_ERROR, 500),
};

// ==================== ERROR HANDLER ====================

/**
 * Convert any error to a standardized API response
 */
export function handleApiError(
  error: unknown,
  context?: string
): NextResponse {
  // Log the error with context
  const timestamp = new Date().toISOString();
  const contextStr = context ? `[${context}]` : '';
  
  console.error(`${timestamp} ${contextStr} API Error:`, error);

  // Handle known ApiError
  if (error instanceof ApiError) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }

  // Handle Supabase errors
  if (isSupabaseError(error)) {
    const supabaseError = error as SupabaseError;
    const mappedError = mapSupabaseError(supabaseError);
    return NextResponse.json(mappedError.toJSON(), { status: mappedError.statusCode });
  }

  // Handle standard Error
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service temporarily unavailable',
          code: ErrorCodes.SERVICE_UNAVAILABLE,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An unexpected error occurred',
        code: ErrorCodes.INTERNAL_ERROR,
      },
      { status: 500 }
    );
  }

  // Handle unknown error types
  return NextResponse.json(
    {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.UNKNOWN_ERROR,
    },
    { status: 500 }
  );
}

// ==================== SUPABASE ERROR HANDLING ====================

interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function isSupabaseError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('code' in error || 'message' in error) &&
    !('statusCode' in error) // Not already an ApiError
  );
}

function mapSupabaseError(error: SupabaseError): ApiError {
  const code = error.code || '';
  const message = error.message || 'Database error';

  // Map Supabase/PostgreSQL error codes
  switch (code) {
    case '23505': // unique_violation
      return new ApiError(
        'This record already exists',
        ErrorCodes.DUPLICATE_ENTRY,
        409,
        { originalError: message }
      );

    case '23503': // foreign_key_violation
      return new ApiError(
        'Referenced record does not exist',
        ErrorCodes.FOREIGN_KEY_VIOLATION,
        400,
        { originalError: message }
      );

    case 'PGRST116': // No rows returned
      return new ApiError('Record not found', ErrorCodes.NOT_FOUND, 404);

    case '42501': // insufficient_privilege
      return new ApiError('Access denied', ErrorCodes.FORBIDDEN, 403);

    case '28P01': // invalid_password
    case 'invalid_grant':
      return new ApiError('Invalid credentials', ErrorCodes.UNAUTHORIZED, 401);

    default:
      return new ApiError(message, ErrorCodes.DB_ERROR, 500, { code });
  }
}

// ==================== WRAPPER FOR API ROUTES ====================

type ApiHandler = (request: Request, context?: any) => Promise<NextResponse>;

/**
 * Wrap an API handler with standardized error handling
 * 
 * Usage:
 * export const POST = withErrorHandling(async (request) => {
 *   // Your handler code
 *   return NextResponse.json({ success: true, data: result });
 * }, 'create-payment');
 */
export function withErrorHandling(
  handler: ApiHandler,
  context?: string
): ApiHandler {
  return async (request: Request, routeContext?: any) => {
    try {
      return await handler(request, routeContext);
    } catch (error) {
      return handleApiError(error, context);
    }
  };
}

// ==================== VALIDATION HELPERS ====================

/**
 * Validate required fields in request body
 */
export function validateRequired<T extends Record<string, any>>(
  body: T,
  requiredFields: (keyof T)[]
): void {
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      throw Errors.missingField(String(field));
    }
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw Errors.validation('Invalid email format', { field: 'email' });
  }
}

/**
 * Validate phone number (Indian format)
 */
export function validatePhone(phone: string): void {
  const phoneRegex = /^[6-9]\d{9}$/;
  const cleaned = phone.replace(/\D/g, '').slice(-10);
  if (!phoneRegex.test(cleaned)) {
    throw Errors.validation('Invalid phone number', { field: 'phone' });
  }
}

// ==================== LOGGING HELPERS ====================

export function logInfo(context: string, message: string, data?: Record<string, any>) {
  console.log(`[${new Date().toISOString()}] [${context}] ${message}`, data || '');
}

export function logError(context: string, message: string, error?: unknown) {
  console.error(`[${new Date().toISOString()}] [${context}] ERROR: ${message}`, error || '');
}

export function logWarn(context: string, message: string, data?: Record<string, any>) {
  console.warn(`[${new Date().toISOString()}] [${context}] WARN: ${message}`, data || '');
}
