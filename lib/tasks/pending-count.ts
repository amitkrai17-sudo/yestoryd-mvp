// ============================================================
// FILE: lib/tasks/pending-count.ts
// Counts tasks still within their actionable window (task_date >= today
// AND is_completed = false). Used by the recs cron and generate-daily-tasks
// to enforce MAX_PENDING_TASKS cap. Expired tasks (task_date < today) do
// NOT count toward the cap regardless of source.
// ============================================================

export const MAX_PENDING_TASKS = 3;

export async function getPendingTaskCount(
  supabase: { from: (table: string) => any },
  childId: string,
): Promise<number> {
  const todayStr = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('parent_daily_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId)
    .eq('is_completed', false)
    .gte('task_date', todayStr);

  return count || 0;
}

/**
 * Check if more auto-generated tasks can be created.
 * Returns true if pending count < MAX_PENDING_TASKS.
 */
export function canCreateMoreTasks(pendingCount: number): boolean {
  return pendingCount < MAX_PENDING_TASKS;
}
