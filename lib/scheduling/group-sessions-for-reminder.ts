// ============================================================================
// GROUP SESSIONS FOR REMINDER
// lib/scheduling/group-sessions-for-reminder.ts
// ============================================================================
//
// Helper for Phase 2.4 — session-reminder dedupe by batch_id.
//
// Groups scheduled_sessions rows so that siblings sharing a batch_id + slot
// collapse into ONE send, while non-batched rows remain their own group of
// one. Mirrors the `batchId + scheduled_date + scheduled_time` key shape
// used by lib/recall-auto-bot.ts's per-batch-per-datetime dedup.
//
// Deliberately does NOT import Supabase or the notify engine — this file is
// a pure data transform so it's trivially unit-testable and safe to reuse
// from any cron (coach 1h, enrollment-lifecycle 24h, future parent reminders).
// ============================================================================

export type ChildRel = {
  id?: string;
  name?: string | null;
  child_name?: string | null;
};

export interface ReminderSessionRow {
  id: string;
  batch_id?: string | null;
  scheduled_date: string;
  scheduled_time: string;
  // Supabase relational selects may return a single object OR a single-element
  // array depending on the join. Helper tolerates either.
  children?: ChildRel | ChildRel[] | null;
}

export interface ReminderGroup<T extends ReminderSessionRow> {
  /** `${batch_id ?? session.id}:${scheduled_date}:${scheduled_time}` */
  key: string;
  /** First row encountered for this key (used as the send representative). */
  primary: T;
  /** Every row sharing this key, in input order. Includes `primary`. */
  siblings: T[];
  /** Child names in input order. Duplicates retained (shouldn't happen for real batches). */
  childNames: string[];
  /** session.id values for the bulk post-send UPDATE. */
  sessionIds: string[];
}

/**
 * Join 1..N child names in Oxford prose:
 *   N=0 → ''
 *   N=1 → 'Harshi'
 *   N=2 → 'Harshi & Shivaay'
 *   N≥3 → 'Anirudh, Parinee, Raysha & Suryanshi'
 */
export function joinChildNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/**
 * Group `scheduled_sessions` rows by (batch_id ?? session.id, date, time).
 *
 * - batch_id != null → siblings collapse into ONE group
 * - batch_id == null → each row is its own group of one
 *
 * Group insertion order tracks first occurrence of each key.
 */
export function groupSessionsForReminder<T extends ReminderSessionRow>(
  sessions: T[],
): ReminderGroup<T>[] {
  const groups = new Map<string, ReminderGroup<T>>();

  for (const s of sessions) {
    const groupId = s.batch_id ?? s.id;
    const key = `${groupId}:${s.scheduled_date}:${s.scheduled_time}`;

    const childRaw = Array.isArray(s.children) ? s.children[0] : s.children;
    const childName = childRaw?.child_name || childRaw?.name || 'Student';

    let g = groups.get(key);
    if (!g) {
      g = { key, primary: s, siblings: [], childNames: [], sessionIds: [] };
      groups.set(key, g);
    }
    g.siblings.push(s);
    g.childNames.push(childName);
    g.sessionIds.push(s.id);
  }

  return Array.from(groups.values());
}
