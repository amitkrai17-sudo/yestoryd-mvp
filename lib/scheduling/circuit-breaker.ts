// ============================================================================
// CIRCUIT BREAKER FOR EXTERNAL APIs
// lib/scheduling/circuit-breaker.ts
// ============================================================================
//
// Prevents cascading failures when external services (Google Calendar,
// Recall.ai) are down. Opens circuit after repeated failures, allows
// half-open probes after a reset timeout.
//
// State is persisted to Redis (shared across serverless instances) with
// in-memory fallback when Redis is unavailable.
//
// ============================================================================

import {
  getCircuitStateFromRedis,
  setCircuitStateInRedis,
  type RedisCircuitState,
} from './redis-store';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const memoryCircuits: Map<string, CircuitState> = new Map();

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 60000; // 1 minute

// ============================================================================
// INTERNAL: load state from Redis, fall back to in-memory
// ============================================================================

async function loadState(service: string): Promise<CircuitState> {
  // Try Redis first
  const redisState = await getCircuitStateFromRedis(service);
  if (redisState.failures > 0 || redisState.state !== 'closed') {
    return redisState;
  }

  // Fallback to in-memory
  return memoryCircuits.get(service) || {
    failures: 0,
    lastFailure: 0,
    state: 'closed',
  };
}

async function saveState(service: string, circuit: CircuitState): Promise<void> {
  memoryCircuits.set(service, circuit);
  await setCircuitStateInRedis(service, circuit);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Execute an operation with circuit breaker protection.
 * Throws if the circuit is open and reset timeout hasn't elapsed.
 */
export async function withCircuitBreaker<T>(
  service: string,
  operation: () => Promise<T>
): Promise<T> {
  const circuit = await loadState(service);

  // Check if circuit is open
  if (circuit.state === 'open') {
    if (Date.now() - circuit.lastFailure > RESET_TIMEOUT_MS) {
      circuit.state = 'half-open';
    } else {
      throw new Error(`Circuit breaker OPEN for ${service}`);
    }
  }

  try {
    const result = await operation();

    // Success — reset circuit
    circuit.failures = 0;
    circuit.state = 'closed';
    await saveState(service, circuit);

    return result;
  } catch (error) {
    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (circuit.failures >= FAILURE_THRESHOLD) {
      circuit.state = 'open';
      console.error(`[CircuitBreaker] Circuit OPEN for ${service} after ${circuit.failures} failures`);
    }

    await saveState(service, circuit);
    throw error;
  }
}

/**
 * Get circuit state for monitoring/admin dashboards.
 */
export async function getCircuitState(service: string): Promise<CircuitState> {
  return loadState(service);
}

/**
 * Manually reset a circuit (e.g., after admin confirms service is back).
 */
export async function resetCircuit(service: string): Promise<void> {
  memoryCircuits.delete(service);
  await setCircuitStateInRedis(service, { failures: 0, lastFailure: 0, state: 'closed' });
}
