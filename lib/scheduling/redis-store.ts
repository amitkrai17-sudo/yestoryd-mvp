// ============================================================================
// REDIS STORE FOR SCHEDULING
// lib/scheduling/redis-store.ts
// ============================================================================
//
// Shared Redis state for idempotency and circuit breaker.
// Uses Upstash Redis (already in project via QStash/ratelimit).
// Falls back gracefully when Redis is unavailable.
//
// ============================================================================

import { Redis } from '@upstash/redis';

// ============================================================================
// CLIENT
// ============================================================================

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

// ============================================================================
// IDEMPOTENCY
// ============================================================================

/**
 * Check if an event has already been processed within the TTL window.
 * Returns cached result if duplicate, or { isDuplicate: false }.
 */
export async function checkIdempotency(
  key: string,
  ttlSeconds: number = 10
): Promise<{ isDuplicate: boolean; cachedResult?: any }> {
  const client = getRedis();
  if (!client) return { isDuplicate: false };

  try {
    const cached = await client.get(`idemp:${key}`);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return { isDuplicate: true, cachedResult: parsed };
    }
    return { isDuplicate: false };
  } catch {
    return { isDuplicate: false };
  }
}

/**
 * Store an event result for idempotency deduplication.
 */
export async function setIdempotency(
  key: string,
  result: any,
  ttlSeconds: number = 10
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(`idemp:${key}`, JSON.stringify(result), { ex: ttlSeconds });
  } catch {
    // Non-fatal — in-memory fallback handles it
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export interface RedisCircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

/**
 * Get circuit breaker state from Redis.
 * Returns default closed state if not found or Redis unavailable.
 */
export async function getCircuitStateFromRedis(
  service: string
): Promise<RedisCircuitState> {
  const defaultState: RedisCircuitState = { failures: 0, lastFailure: 0, state: 'closed' };
  const client = getRedis();
  if (!client) return defaultState;

  try {
    const state = await client.get(`circuit:${service}`);
    if (state) {
      return typeof state === 'string' ? JSON.parse(state) : state as RedisCircuitState;
    }
    return defaultState;
  } catch {
    return defaultState;
  }
}

/**
 * Persist circuit breaker state to Redis.
 * TTL of 5 minutes — stale open circuits auto-recover.
 */
export async function setCircuitStateInRedis(
  service: string,
  state: RedisCircuitState
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(`circuit:${service}`, JSON.stringify(state), { ex: 300 });
  } catch {
    // Non-fatal
  }
}
