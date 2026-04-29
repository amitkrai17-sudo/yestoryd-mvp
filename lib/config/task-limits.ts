// =============================================================================
// TASK LIMITS CONFIG LOADER
// lib/config/task-limits.ts
// =============================================================================
//
// Cached loader for parent_daily_tasks limit knobs. Reads three site_settings
// keys in one round-trip:
//   task_max_pending   — auto-generated cap (coach_assigned bypasses)
//   task_expiry_days   — auto-expire grace window
//   task_window_days   — parent dashboard / overdue-nudge read horizon
//
// Pattern mirrors lib/config/site-settings-loader.ts:
//   - 5-minute TTL, module-scoped cache
//   - createAdminClient() per-call
//   - FALLBACK constant used on DB error
//   - clearTaskLimitsCache() exported for admin update flows
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

export interface TaskLimitsConfig {
  maxPendingTasks: number;
  taskExpiryDays: number;
  taskWindowDays: number;
  fetchedAt: number;
}

const FALLBACK: TaskLimitsConfig = {
  maxPendingTasks: 3,
  taskExpiryDays: 7,
  taskWindowDays: 7,
  fetchedAt: 0,
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: TaskLimitsConfig | null = null;

function isCacheValid(entry: TaskLimitsConfig | null): entry is TaskLimitsConfig {
  return entry != null && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

function parseIntOr(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  const cleaned = String(value).replace(/"/g, '').trim();
  if (!cleaned) return fallback;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? fallback : n;
}

export async function getTaskLimits(): Promise<TaskLimitsConfig> {
  if (isCacheValid(cached)) return cached;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['task_max_pending', 'task_expiry_days', 'task_window_days']);

    if (error) {
      console.error('[TaskLimits] DB error, using fallback:', error.message);
      cached = { ...FALLBACK, fetchedAt: Date.now() };
      return cached;
    }

    const map = new Map<string, unknown>((data || []).map(row => [row.key, row.value]));
    const config: TaskLimitsConfig = {
      maxPendingTasks: parseIntOr(map.get('task_max_pending'), FALLBACK.maxPendingTasks),
      taskExpiryDays: parseIntOr(map.get('task_expiry_days'), FALLBACK.taskExpiryDays),
      taskWindowDays: parseIntOr(map.get('task_window_days'), FALLBACK.taskWindowDays),
      fetchedAt: Date.now(),
    };
    cached = config;
    return config;
  } catch (err) {
    console.error('[TaskLimits] Unexpected error, using fallback:', err);
    cached = { ...FALLBACK, fetchedAt: Date.now() };
    return cached;
  }
}

export function canCreateMoreTasks(config: TaskLimitsConfig, pendingCount: number): boolean {
  return pendingCount < config.maxPendingTasks;
}

export function clearTaskLimitsCache(): void {
  cached = null;
}
