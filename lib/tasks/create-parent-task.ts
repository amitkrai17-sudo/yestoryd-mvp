// ============================================================
// FILE: lib/tasks/create-parent-task.ts
// Single creation contract for parent_daily_tasks.
// PR 1: helper landed but no writer wired yet. PR 2 migrates W1-W6.
//
// Idempotency: writer composes a deterministic seed; this helper prefixes
// it with the source. The DB partial unique index on idempotency_key
// converts duplicate inserts into a clean { created: false } result.
//
// Cap policy: 'ai_recommended' and 'template_generated' respect the
// site_settings cap. 'coach_assigned' and 'system' bypass — they are
// human-driven or scheduling-driven and must not be silently dropped.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getTaskLimits } from '@/lib/config/task-limits';

export type TaskSource =
  | 'coach_assigned'
  | 'ai_recommended'
  | 'template_generated'
  | 'system';

export interface CreateTaskInput {
  child_id: string;
  source: TaskSource;
  idempotency_seed: string;
  title: string;
  description: string;
  task_date?: string;
  session_id?: string | null;
  enrollment_id?: string | null;
  duration_minutes?: number;
  linked_skill?: string | null;
  coach_notes?: string | null;
  content_item_id?: string | null;
}

export type CreateTaskResult =
  | { created: true; task: { id: string } }
  | { created: false; reason: 'duplicate' }
  | { created: false; reason: 'cap_reached' };

const CAPPED_SOURCES: ReadonlySet<TaskSource> = new Set([
  'ai_recommended',
  'template_generated',
]);

export async function createParentTask(input: CreateTaskInput): Promise<CreateTaskResult> {
  const supabase = createAdminClient();
  const config = await getTaskLimits();
  const today = new Date().toISOString().split('T')[0];
  const idempotency_key = `${input.source}:${input.idempotency_seed}`;

  if (CAPPED_SOURCES.has(input.source)) {
    const { count } = await supabase
      .from('parent_daily_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', input.child_id)
      .eq('status', 'active');

    if ((count ?? 0) >= config.maxPendingTasks) {
      return { created: false, reason: 'cap_reached' };
    }
  }

  const { data, error } = await supabase
    .from('parent_daily_tasks')
    .insert({
      child_id: input.child_id,
      source: input.source,
      idempotency_key,
      status: 'active',
      is_completed: false,
      title: input.title,
      description: input.description,
      task_date: input.task_date ?? today,
      session_id: input.session_id ?? null,
      enrollment_id: input.enrollment_id ?? null,
      duration_minutes: input.duration_minutes ?? 15,
      linked_skill: input.linked_skill ?? null,
      coach_notes: input.coach_notes ?? null,
      content_item_id: input.content_item_id ?? null,
    })
    .select('id')
    .single();

  if (error?.code === '23505') {
    return { created: false, reason: 'duplicate' };
  }
  if (error) throw error;
  if (!data) throw new Error('createParentTask: insert returned no row');

  return { created: true, task: { id: data.id } };
}
