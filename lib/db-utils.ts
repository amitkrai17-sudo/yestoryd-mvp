/**
 * Database Utilities for Yestoryd
 *
 * Utilities for optimizing database operations:
 * - conditionalUpdate: Prevents ghost writes by checking if data changed
 * - timedQuery: Logs slow queries for performance monitoring
 * - batchUpsert: Bulk inserts with conflict handling
 *
 * Usage:
 * import { conditionalUpdate, timedQuery, batchUpsert } from '@/lib/db-utils';
 */

import { PostgrestError } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/server';

// ============================================================
// TYPES
// ============================================================

interface ConditionalUpdateResult<T> {
  updated: boolean;
  data: T | null;
  error: PostgrestError | null;
  skippedFields?: string[];
}

interface TimedQueryResult<T> {
  data: T;
  error: PostgrestError | null;
  durationMs: number;
}

interface BatchUpsertResult {
  inserted: number;
  error: PostgrestError | null;
}

// ============================================================
// CONDITIONAL UPDATE
// ============================================================

/**
 * Prevents unnecessary database writes by checking if data actually changed.
 *
 * @param table - The Supabase table name
 * @param id - The row ID to update
 * @param newData - The new data to potentially write
 * @param fieldsToCompare - Specific fields to compare (defaults to all newData fields)
 * @returns Result object with updated status, data, and any errors
 *
 * @example
 * const result = await conditionalUpdate('enrollments', enrollmentId, {
 *   status: 'active',
 *   updated_at: new Date().toISOString()
 * }, ['status']); // Only compare status field
 *
 * if (result.updated) {
 *   console.log('Enrollment was updated');
 * }
 */
export async function conditionalUpdate<T extends Record<string, unknown>>(
  table: string,
  id: string,
  newData: Partial<T>,
  fieldsToCompare?: (keyof T)[]
): Promise<ConditionalUpdateResult<T>> {
  try {
    // Fetch current row
    const { data: currentRow, error: fetchError } = await (supabaseAdmin as any)
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error(`[DB] Error fetching ${table}:${id}:`, fetchError.message);
      return { updated: false, data: null, error: fetchError };
    }

    if (!currentRow) {
      console.warn(`[DB] Row not found: ${table}:${id}`);
      return {
        updated: false,
        data: null,
        error: { message: 'Row not found', details: '', hint: '', code: 'PGRST116' } as PostgrestError
      };
    }

    // Determine which fields to compare
    const fields = fieldsToCompare || (Object.keys(newData) as (keyof T)[]);

    // Check for changes
    const changedFields: string[] = [];
    const skippedFields: string[] = [];

    for (const field of fields) {
      const fieldKey = field as string;
      const currentValue = currentRow[fieldKey];
      const newValue = newData[field];

      // Skip undefined values in newData
      if (newValue === undefined) {
        continue;
      }

      // Deep comparison for objects/arrays
      const currentSerialized = typeof currentValue === 'object' && currentValue !== null
        ? JSON.stringify(currentValue)
        : currentValue;
      const newSerialized = typeof newValue === 'object' && newValue !== null
        ? JSON.stringify(newValue)
        : newValue;

      if (currentSerialized !== newSerialized) {
        changedFields.push(fieldKey);
      } else {
        skippedFields.push(fieldKey);
      }
    }

    // No changes - skip update
    if (changedFields.length === 0) {
      console.log(`[DB] Skipped ghost write to ${table}:${id} (no changes in ${fields.length} fields)`);
      return {
        updated: false,
        data: currentRow as T,
        error: null,
        skippedFields: skippedFields
      };
    }

    // Perform update
    const { data: updatedRow, error: updateError } = await (supabaseAdmin as any)
      .from(table)
      .update(newData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error(`[DB] Error updating ${table}:${id}:`, updateError.message);
      return { updated: false, data: null, error: updateError };
    }

    console.log(`[DB] Updated ${table}:${id} (changed: ${changedFields.join(', ')})`);
    return {
      updated: true,
      data: updatedRow as T,
      error: null,
      skippedFields: skippedFields
    };

  } catch (err) {
    const error = err as Error;
    console.error(`[DB] Unexpected error in conditionalUpdate:`, error.message);
    return {
      updated: false,
      data: null,
      error: { message: error.message, details: '', hint: '', code: 'UNKNOWN' } as PostgrestError
    };
  }
}

// ============================================================
// TIMED QUERY
// ============================================================

/**
 * Wraps a Supabase query to measure and log execution time.
 * Logs a warning for queries exceeding the threshold.
 *
 * @param queryFn - Function that returns a Supabase query promise
 * @param queryName - Descriptive name for logging
 * @param slowThresholdMs - Threshold in ms to trigger slow query warning (default: 500ms)
 * @returns Query result with duration in milliseconds
 *
 * @example
 * const result = await timedQuery(
 *   () => supabaseAdmin.from('sessions').select('*').eq('coach_id', coachId),
 *   'fetch-coach-sessions',
 *   300 // warn if > 300ms
 * );
 * console.log(`Query took ${result.durationMs}ms`);
 */
export async function timedQuery<T>(
  queryFn: () => Promise<{ data: T; error: PostgrestError | null }>,
  queryName: string,
  slowThresholdMs: number = 500
): Promise<TimedQueryResult<T>> {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const durationMs = Date.now() - startTime;

    if (durationMs > slowThresholdMs) {
      console.warn(`🐢 [SLOW QUERY] ${queryName}: ${durationMs}ms (threshold: ${slowThresholdMs}ms)`);
    } else if (process.env.NODE_ENV === 'development') {
      // In dev, log all query times for visibility
      console.log(`[DB] ${queryName}: ${durationMs}ms`);
    }

    return {
      data: result.data,
      error: result.error,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const error = err as Error;

    console.error(`[DB] Query failed: ${queryName} (${durationMs}ms):`, error.message);

    return {
      data: null as T,
      error: { message: error.message, details: '', hint: '', code: 'UNKNOWN' } as PostgrestError,
      durationMs,
    };
  }
}

// ============================================================
// BATCH UPSERT
// ============================================================

/**
 * Performs bulk upsert (insert or update on conflict).
 *
 * @param table - The Supabase table name
 * @param records - Array of records to upsert
 * @param conflictColumn - Column to check for conflicts (default: 'id')
 * @returns Number of inserted/updated records and any errors
 *
 * @example
 * const result = await batchUpsert('learning_events', [
 *   { id: '1', child_id: 'abc', event_type: 'session_completed' },
 *   { id: '2', child_id: 'abc', event_type: 'quiz_passed' }
 * ], 'id');
 * console.log(`Upserted ${result.inserted} records`);
 */
export async function batchUpsert<T extends Record<string, unknown>>(
  table: string,
  records: T[],
  conflictColumn: string = 'id'
): Promise<BatchUpsertResult> {
  if (!records || records.length === 0) {
    console.log(`[DB] batchUpsert: No records to insert into ${table}`);
    return { inserted: 0, error: null };
  }

  try {
    const startTime = Date.now();

    const { data, error } = await (supabaseAdmin as any)
      .from(table)
      .upsert(records, {
        onConflict: conflictColumn,
        ignoreDuplicates: false, // Update on conflict instead of ignoring
      })
      .select();

    const durationMs = Date.now() - startTime;

    if (error) {
      console.error(`[DB] batchUpsert error for ${table}:`, error.message);
      return { inserted: 0, error };
    }

    const insertedCount = data?.length || records.length;
    console.log(`[DB] batchUpsert: ${insertedCount} records into ${table} (${durationMs}ms)`);

    return { inserted: insertedCount, error: null };

  } catch (err) {
    const error = err as Error;
    console.error(`[DB] Unexpected error in batchUpsert:`, error.message);
    return {
      inserted: 0,
      error: { message: error.message, details: '', hint: '', code: 'UNKNOWN' } as PostgrestError
    };
  }
}

// ============================================================
// HELPER UTILITIES
// ============================================================

/**
 * Safely extracts count from a Supabase count query.
 *
 * @example
 * const { count } = await supabaseAdmin
 *   .from('sessions')
 *   .select('*', { count: 'exact', head: true })
 *   .eq('status', 'completed');
 * const total = extractCount(count);
 */
export function extractCount(count: number | null): number {
  return count ?? 0;
}

/**
 * Checks if a Supabase error is a "not found" error (PGRST116).
 */
export function isNotFoundError(error: PostgrestError | null): boolean {
  return error?.code === 'PGRST116';
}

/**
 * Checks if a Supabase error is a unique constraint violation.
 */
export function isUniqueViolation(error: PostgrestError | null): boolean {
  return error?.code === '23505';
}
