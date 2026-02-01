// ============================================================================
// TRANSACTION MANAGER (Compensating Actions Pattern)
// lib/scheduling/transaction-manager.ts
// ============================================================================
//
// Supabase REST API doesn't support multi-table transactions.
// This module implements the Saga / compensating actions pattern:
//
// 1. Execute steps sequentially
// 2. On failure, roll back completed steps in reverse order
// 3. Log all compensation attempts
//
// ============================================================================

import { createLogger } from './logger';

const logger = createLogger('transaction-manager');

// ============================================================================
// TYPES
// ============================================================================

export interface TransactionStep<T = any> {
  name: string;
  execute: () => Promise<T>;
  compensate: (result: T) => Promise<void>;
}

export interface TransactionResult {
  success: boolean;
  results: any[];
  failedAt?: string;
  error?: string;
  compensationErrors: string[];
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Execute a sequence of steps with automatic rollback on failure.
 * Each step provides an execute() and a compensate() function.
 * On failure, completed steps are compensated in reverse order.
 */
export async function executeWithCompensation(
  steps: TransactionStep[],
  requestId?: string
): Promise<TransactionResult> {
  const results: any[] = [];
  const completedSteps: { step: TransactionStep; result: any }[] = [];
  const compensationErrors: string[] = [];

  for (const step of steps) {
    try {
      logger.info('transaction_step_start', { requestId, step: step.name });
      const result = await step.execute();
      results.push(result);
      completedSteps.push({ step, result });
      logger.info('transaction_step_complete', { requestId, step: step.name });
    } catch (error: any) {
      logger.error('transaction_step_failed', {
        requestId,
        step: step.name,
        error: error.message,
      });

      // Compensate in reverse order
      for (const completed of completedSteps.reverse()) {
        try {
          logger.info('compensating', { requestId, step: completed.step.name });
          await completed.step.compensate(completed.result);
          logger.info('compensated', { requestId, step: completed.step.name });
        } catch (compError: any) {
          const msg = `${completed.step.name}: ${compError.message}`;
          compensationErrors.push(msg);
          logger.error('compensation_failed', {
            requestId,
            step: completed.step.name,
            error: compError.message,
          });
        }
      }

      return {
        success: false,
        results,
        failedAt: step.name,
        error: error.message,
        compensationErrors,
      };
    }
  }

  return { success: true, results, compensationErrors: [] };
}
