// ============================================================
// FILE: lib/tasks/pending-count.ts
// Counts tasks in 'active' status. Auto-expire is handled by the
// expire-stale-tasks cron (status: active -> expired after grace window).
// PR 2 will replace these callers with getTaskLimits() / createParentTask().
// ============================================================

export const MAX_PENDING_TASKS = 3;

export async function getPendingTaskCount(
  supabase: { from: (table: string) => any },
  childId: string,
): Promise<number> {
  const { count } = await supabase
    .from('parent_daily_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId)
    .eq('status', 'active');

  return count || 0;
}

/**
 * Check if more auto-generated tasks can be created.
 * Returns true if pending count < MAX_PENDING_TASKS.
 */
export function canCreateMoreTasks(pendingCount: number): boolean {
  return pendingCount < MAX_PENDING_TASKS;
}
