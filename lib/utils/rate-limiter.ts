// =============================================================================
// IN-MEMORY RATE LIMITER
// Simple sliding-window rate limiter for API endpoints
// For production at scale, replace with Upstash Redis ratelimit
// =============================================================================

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitRecord>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    Array.from(store.entries()).forEach(([key, record]) => {
      if (now > record.resetTime) {
        store.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number; // seconds
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }
): RateLimitResult {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetTime) {
    store.set(key, { count: 1, resetTime: now + config.windowMs });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetIn: Math.ceil(config.windowMs / 1000),
    };
  }

  if (record.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetIn: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  record.count++;
  return {
    success: true,
    remaining: config.maxRequests - record.count,
    resetIn: Math.ceil((record.resetTime - now) / 1000),
  };
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
}

export function rateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({ error: 'Too many requests', retryAfter: result.resetIn }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': result.resetIn.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
      },
    }
  );
}
