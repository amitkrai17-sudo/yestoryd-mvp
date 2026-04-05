// ============================================================
// Creates a "Reading Progress Check" homework task every 4th session.
// Links to the micro-assessment pipeline for audio analysis.
// ============================================================

interface ReadingTestParams {
  childId: string;
  childName: string;
  enrollmentId?: string;
  sessionId?: string;
  sessionNumber?: number;
  supabase: any;
}

const SESSION_INTERVAL = 4; // Every 4th session
const MIN_DAYS_BETWEEN = 14; // At least 2 weeks apart

export async function createReadingTestTask(
  params: ReadingTestParams
): Promise<{ taskId: string } | null> {
  const { childId, childName, enrollmentId, sessionId, sessionNumber, supabase } = params;

  // Check session interval (4, 8, 12, 16...)
  if (sessionNumber && sessionNumber % SESSION_INTERVAL !== 0) return null;

  // Check last micro-assessment — skip if too recent
  const { data: lastTest } = await supabase
    .from('micro_assessments')
    .select('created_at')
    .eq('child_id', childId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastTest) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastTest.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince < MIN_DAYS_BETWEEN) return null;
  }

  // Check pending count — respect the 3-task cap
  const { getPendingTaskCount, canCreateMoreTasks } = await import('@/lib/tasks/pending-count');
  const pendingCount = await getPendingTaskCount(supabase, childId);
  if (!canCreateMoreTasks(pendingCount)) return null;

  const firstName = childName.split(' ')[0];

  const { data: task } = await supabase
    .from('parent_daily_tasks')
    .insert({
      child_id: childId,
      enrollment_id: enrollmentId || null,
      session_id: sessionId || null,
      task_date: new Date().toISOString().split('T')[0],
      title: 'Reading Progress Check',
      description: `Time for ${firstName}'s reading check! Read a short passage aloud and see how much they've improved. Takes just 2 minutes.`,
      source: 'system',
      is_completed: false,
      duration_minutes: 3,
      linked_skill: 'reading_fluency',
    })
    .select('id')
    .single();

  if (task) {
    console.log(`[ReadingTest] Task created for ${childName} after session ${sessionNumber}`);
  }

  return task ? { taskId: task.id } : null;
}
