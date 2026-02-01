// ============================================================================
// CIRCUIT BREAKER TESTS
// __tests__/scheduling/circuit-breaker.test.ts
// ============================================================================

// Mock redis-store before importing circuit-breaker
jest.mock('@/lib/scheduling/redis-store', () => ({
  getCircuitStateFromRedis: jest.fn().mockResolvedValue({
    failures: 0,
    lastFailure: 0,
    state: 'closed',
  }),
  setCircuitStateInRedis: jest.fn().mockResolvedValue(undefined),
}));

import { withCircuitBreaker, getCircuitState, resetCircuit } from '@/lib/scheduling/circuit-breaker';
import { getCircuitStateFromRedis, setCircuitStateInRedis } from '@/lib/scheduling/redis-store';

const mockGetRedis = getCircuitStateFromRedis as jest.Mock;
const mockSetRedis = setCircuitStateInRedis as jest.Mock;

describe('Circuit Breaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedis.mockResolvedValue({ failures: 0, lastFailure: 0, state: 'closed' });
    mockSetRedis.mockResolvedValue(undefined);
  });

  it('should execute operation when circuit is closed', async () => {
    const operation = jest.fn().mockResolvedValue('result');
    const result = await withCircuitBreaker('test-service', operation);

    expect(result).toBe('result');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should reset failures on success', async () => {
    const operation = jest.fn().mockResolvedValue('ok');
    await withCircuitBreaker('test-service', operation);

    expect(mockSetRedis).toHaveBeenCalledWith(
      'test-service',
      expect.objectContaining({ failures: 0, state: 'closed' })
    );
  });

  it('should increment failures on error', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(withCircuitBreaker('test-service', operation)).rejects.toThrow('fail');

    expect(mockSetRedis).toHaveBeenCalledWith(
      'test-service',
      expect.objectContaining({ failures: 1 })
    );
  });

  it('should open circuit after 5 failures', async () => {
    // Simulate 4 prior failures in Redis
    mockGetRedis.mockResolvedValue({ failures: 4, lastFailure: Date.now(), state: 'closed' });

    const operation = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(withCircuitBreaker('test-service', operation)).rejects.toThrow('fail');

    expect(mockSetRedis).toHaveBeenCalledWith(
      'test-service',
      expect.objectContaining({ failures: 5, state: 'open' })
    );
  });

  it('should reject immediately when circuit is open', async () => {
    mockGetRedis.mockResolvedValue({
      failures: 5,
      lastFailure: Date.now(),
      state: 'open',
    });

    const operation = jest.fn().mockResolvedValue('ok');
    await expect(withCircuitBreaker('test-service', operation)).rejects.toThrow(
      'Circuit breaker OPEN for test-service'
    );
    expect(operation).not.toHaveBeenCalled();
  });

  it('should allow half-open probe after reset timeout', async () => {
    mockGetRedis.mockResolvedValue({
      failures: 5,
      lastFailure: Date.now() - 70000, // 70s ago, past 60s timeout
      state: 'open',
    });

    const operation = jest.fn().mockResolvedValue('recovered');
    const result = await withCircuitBreaker('test-service', operation);

    expect(result).toBe('recovered');
    expect(mockSetRedis).toHaveBeenCalledWith(
      'test-service',
      expect.objectContaining({ failures: 0, state: 'closed' })
    );
  });

  it('should reset circuit manually', async () => {
    await resetCircuit('test-service');

    expect(mockSetRedis).toHaveBeenCalledWith(
      'test-service',
      { failures: 0, lastFailure: 0, state: 'closed' }
    );
  });

  it('should return current state via getCircuitState', async () => {
    mockGetRedis.mockResolvedValue({ failures: 3, lastFailure: 123, state: 'closed' });

    const state = await getCircuitState('test-service');
    expect(state.failures).toBe(3);
  });
});
