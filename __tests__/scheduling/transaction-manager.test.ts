// ============================================================================
// TRANSACTION MANAGER TESTS
// __tests__/scheduling/transaction-manager.test.ts
// ============================================================================

jest.mock('@/lib/scheduling/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { executeWithCompensation, type TransactionStep } from '@/lib/scheduling/transaction-manager';

describe('Transaction Manager', () => {
  it('should execute all steps successfully', async () => {
    const steps: TransactionStep[] = [
      {
        name: 'step_1',
        execute: jest.fn().mockResolvedValue({ id: 'a' }),
        compensate: jest.fn(),
      },
      {
        name: 'step_2',
        execute: jest.fn().mockResolvedValue({ id: 'b' }),
        compensate: jest.fn(),
      },
    ];

    const result = await executeWithCompensation(steps);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.compensationErrors).toHaveLength(0);
    expect(steps[0].compensate).not.toHaveBeenCalled();
    expect(steps[1].compensate).not.toHaveBeenCalled();
  });

  it('should compensate completed steps on failure (reverse order)', async () => {
    const compensate1 = jest.fn();
    const compensate2 = jest.fn();
    const callOrder: string[] = [];

    const steps: TransactionStep[] = [
      {
        name: 'step_1',
        execute: jest.fn().mockResolvedValue({ id: 'a' }),
        compensate: async (r) => { callOrder.push('comp_1'); compensate1(r); },
      },
      {
        name: 'step_2',
        execute: jest.fn().mockResolvedValue({ id: 'b' }),
        compensate: async (r) => { callOrder.push('comp_2'); compensate2(r); },
      },
      {
        name: 'step_3',
        execute: jest.fn().mockRejectedValue(new Error('step 3 failed')),
        compensate: jest.fn(),
      },
    ];

    const result = await executeWithCompensation(steps);

    expect(result.success).toBe(false);
    expect(result.failedAt).toBe('step_3');
    expect(result.error).toBe('step 3 failed');
    // Compensation in reverse order
    expect(callOrder).toEqual(['comp_2', 'comp_1']);
    expect(compensate2).toHaveBeenCalledWith({ id: 'b' });
    expect(compensate1).toHaveBeenCalledWith({ id: 'a' });
  });

  it('should report compensation errors without throwing', async () => {
    const steps: TransactionStep[] = [
      {
        name: 'step_1',
        execute: jest.fn().mockResolvedValue('ok'),
        compensate: jest.fn().mockRejectedValue(new Error('compensation failed')),
      },
      {
        name: 'step_2',
        execute: jest.fn().mockRejectedValue(new Error('step 2 failed')),
        compensate: jest.fn(),
      },
    ];

    const result = await executeWithCompensation(steps);

    expect(result.success).toBe(false);
    expect(result.compensationErrors).toHaveLength(1);
    expect(result.compensationErrors[0]).toContain('step_1');
  });

  it('should handle empty steps array', async () => {
    const result = await executeWithCompensation([]);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it('should fail on first step and not call compensate for it', async () => {
    const compensate = jest.fn();
    const steps: TransactionStep[] = [
      {
        name: 'step_1',
        execute: jest.fn().mockRejectedValue(new Error('immediate fail')),
        compensate,
      },
    ];

    const result = await executeWithCompensation(steps);

    expect(result.success).toBe(false);
    expect(result.failedAt).toBe('step_1');
    // The failed step itself should NOT be compensated
    expect(compensate).not.toHaveBeenCalled();
  });
});
