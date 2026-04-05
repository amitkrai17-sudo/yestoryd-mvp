// ============================================================
// FILE: lib/tasks/pending-count.ts
// PURPOSE: Shared helper for homework task count limits
// Rule: Max 3 pending tasks per child (auto-generated only)
// Coach-assigned tasks bypass the cap.
// ============================================================

export const MAX_PENDING_TASKS = 3;

/**
 * Count pending (incomplete) tasks for a child.
 */
export async function getPendingTaskCount(
  supabase: { from: (table: string) => any },
  childId: string,
): Promise<number> {
  const { count } = await supabase
    .from('parent_daily_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId)
    .eq('is_completed', false);

  return count || 0;
}

/**
 * Check if more auto-generated tasks can be created.
 * Returns true if pending count < MAX_PENDING_TASKS.
 */
export function canCreateMoreTasks(pendingCount: number): boolean {
  return pendingCount < MAX_PENDING_TASKS;
}
