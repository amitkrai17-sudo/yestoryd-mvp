// ============================================================
// FILE: lib/scheduling/session-calendar-writer.ts
// PURPOSE: THE single canonical, reconciling writer for a scheduled_session's
//   Google Calendar event (Phase 2A). It is the SOLE creator/updater of a
//   tuition/coaching session event. Invariants:
//     1. Reads date/time/mode from scheduled_sessions (SSOT) — NEVER from
//        tuition_onboarding.schedule_preference (the A13 06:00-vs-18:00 source).
//     2. Idempotent + reconciling: noop when the live event already matches;
//        patch on time-only drift; delete+create on mode/meet drift (EXCLUSIVE
//        events only); DETACH (new event, original untouched) on SHARED events.
//     3. Offline ⇒ conferenceDataVersion:0, NO conferenceData, google_meet_link
//        NULL, location=offline_location. Re-evaluated every reconcile.
//     4. Writes back google_event_id + google_meet_link via attachCalendarLink
//        (the SOLE calendar-column DB writer) — no parallel link-writer.
//     5. One UNIQUE event per session — never a shared event across children.
//
//   Organizer = the session's coach email (domain-wide-delegation impersonation),
//   so events.get/patch/delete resolve against the series owner, not an attendee
//   copy.
//
//   SHARED-EVENT SAFETY (Phase-1 correction): deleting a shared event would break
//   sibling enrollments still pointing at it. A live ref-count gate (sessions
//   sharing the id, or a recurrence rule) routes shared events to DETACH; the
//   original is left for the 2B orphan sweep once nothing references it.
// ============================================================

import { getCalendarClient } from '@/lib/calendar/auth';
import { getEventDetails, deleteCalendarEvent, rescheduleEvent } from '@/lib/calendar/events';
import { attachCalendarLink } from './calendar-link';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

type AdminClient = ReturnType<typeof createAdminClient>;

export type ReconcileAction =
  | 'noop'        // live event matches desired — no API write
  | 'created'     // no prior event (or live 404) — fresh event
  | 'patched'     // exclusive, time-only drift — events.patch
  | 'recreated'   // exclusive, mode/meet drift — delete + create
  | 'detached'    // shared/recurring — NEW unique event, original untouched
  | 'skipped';    // not actionable (no coach/time, cancelled/completed)

export interface ReconcileResult {
  action: ReconcileAction;
  eventId: string | null;
  meetLink: string | null;
  error?: string;
}

export interface ReconcileOpts {
  /** Pre-built admin client (one is created if absent). */
  supabase?: AdminClient;
  /** Google sendUpdates for CREATE/PATCH. Default 'all' (interactive paths notify).
   *  The 2B sweep deletes silently; 2C recreate passes 'all'. */
  sendUpdates?: 'all' | 'none';
  requestId?: string;
}

/** Two ISO timestamps refer to the same instant (1s tolerance). */
function sameInstant(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return Number.isFinite(ta) && Number.isFinite(tb) && Math.abs(ta - tb) < 1000;
}

/**
 * Reconcile (create / update / detach) the Google Calendar event for ONE
 * scheduled_session against the DB SSOT. Returns the resulting event id + meet
 * link (already written back to the row). Safe to call repeatedly — a matched
 * event is a noop, which is what makes the every-payment re-queue cost-free.
 */
export async function reconcileSessionCalendarEvent(
  sessionId: string,
  opts: ReconcileOpts = {},
): Promise<ReconcileResult> {
  const supabase = opts.supabase ?? createAdminClient();
  const sendUpdates = opts.sendUpdates ?? 'all';

  // 1. SSOT read — date/time/mode come from scheduled_sessions, never preferences.
  const { data: s, error } = await supabase
    .from('scheduled_sessions')
    .select(
      'id, scheduled_date, scheduled_time, duration_minutes, session_mode, offline_location, session_type, session_number, google_event_id, google_meet_link, coach_id, child_id, status, children(child_name, name, parent_email, parent_name), coaches(email, name)',
    )
    .eq('id', sessionId)
    .single();

  if (error || !s) {
    return { action: 'skipped', eventId: null, meetLink: null, error: 'session_not_found' };
  }

  const child = Array.isArray(s.children) ? s.children[0] : s.children;
  const coach = Array.isArray(s.coaches) ? s.coaches[0] : s.coaches;
  const coachEmail = coach?.email ?? null;
  const priorEventId = s.google_event_id ?? null;
  const priorMeet = s.google_meet_link ?? null;

  // Guard rails — organizer + a concrete SSOT date/time are required; no back-derivation.
  if (!coachEmail) {
    return { action: 'skipped', eventId: priorEventId, meetLink: priorMeet, error: 'no_coach_email' };
  }
  if (!s.scheduled_date || !s.scheduled_time || s.scheduled_time === '00:00:00') {
    return { action: 'skipped', eventId: priorEventId, meetLink: priorMeet, error: 'no_scheduled_time' };
  }
  if (s.status === 'cancelled' || s.status === 'completed' || s.status === 'missed') {
    return { action: 'skipped', eventId: priorEventId, meetLink: priorMeet, error: `status_${s.status}` };
  }

  const isOffline = s.session_mode === 'offline';
  const isTuition = s.session_type === 'tuition';
  const isCoaching = s.session_type === 'coaching';
  const childName = child?.child_name || child?.name || 'Student';
  const duration = s.duration_minutes || (isCoaching ? 45 : isTuition ? 60 : 30);

  const start = new Date(`${s.scheduled_date}T${s.scheduled_time}+05:30`);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + duration);
  const desiredStartISO = start.toISOString();
  const desiredEndISO = end.toISOString();

  const calendar = getCalendarClient(coachEmail);

  // Offline-aware event body (mode re-evaluated on every reconcile).
  const buildBody = (): Record<string, unknown> => {
    const title = isTuition
      ? `Yestoryd: ${childName} - English Classes Session ${s.session_number ?? ''}`
      : isCoaching
        ? `Yestoryd: ${childName} - 1:1 Coaching Session ${s.session_number ?? ''}`
        : `Yestoryd: ${childName} - Parent Check-in`;
    const kind = isTuition ? 'English Classes' : isCoaching ? '1:1 Coaching' : 'Parent Check-in';
    const base = `${kind} session with ${childName}\n\nCoach: ${coach?.name ?? ''}\nDuration: ${duration} minutes\n\nQuestions? WhatsApp: ${COMPANY_CONFIG.leadBotWhatsAppDisplay}`;
    const description = isOffline ? `${base}\n\n[OFFLINE SESSION - In Person]` : base;
    const attendees = [
      child?.parent_email ? { email: child.parent_email, displayName: child.parent_name ?? 'Parent' } : null,
      { email: COMPANY_CONFIG.supportEmail, displayName: 'Yestoryd (Recording)' },
    ].filter(Boolean) as { email: string; displayName: string }[];

    const body: Record<string, unknown> = {
      summary: title,
      description,
      start: { dateTime: desiredStartISO, timeZone: 'Asia/Kolkata' },
      end: { dateTime: desiredEndISO, timeZone: 'Asia/Kolkata' },
      attendees,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
      colorId: isTuition ? '6' : isCoaching ? '9' : '5',
    };
    if (!isOffline) {
      body.conferenceData = {
        createRequest: {
          requestId: `yestoryd-session-${s.id}-${start.getTime()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }
    if (isOffline && s.offline_location) body.location = s.offline_location;
    return body;
  };

  // Create a fresh unique event and write it back to THIS session.
  const createNew = async (action: ReconcileAction): Promise<ReconcileResult> => {
    const ev = await calendar.events.insert({
      calendarId: coachEmail,
      conferenceDataVersion: isOffline ? 0 : 1,
      sendUpdates,
      requestBody: buildBody(),
    });
    const newId = ev.data.id ?? null;
    const newMeet = isOffline
      ? null
      : ev.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri
        || ev.data.hangoutLink
        || null;
    await attachCalendarLink(supabase, s.id, newId, newMeet);
    return { action, eventId: newId, meetLink: newMeet };
  };

  // 2. No prior event → create.
  if (!priorEventId) return createNew('created');

  // 3. Live fetch. Gone (404/410 → null) → create fresh.
  const live = await getEventDetails(priorEventId, coachEmail);
  if (!live) return createNew('created');

  // 4. SHARED gate — never delete/patch a shared or recurring event (would break
  //    siblings). DETACH this session onto its own new event; leave the original.
  const { count: refCount } = await supabase
    .from('scheduled_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('google_event_id', priorEventId)
    .neq('status', 'cancelled');
  const isShared = (refCount ?? 0) > 1 || (Array.isArray(live.recurrence) && live.recurrence.length > 0);
  if (isShared) return createNew('detached');

  // 5. EXCLUSIVE — compare live vs desired.
  const liveHasMeet = !!(live.hangoutLink || (live.conferenceData?.entryPoints?.length ?? 0) > 0);
  const timeMatch =
    sameInstant(live.start?.dateTime ?? null, desiredStartISO) &&
    sameInstant(live.end?.dateTime ?? null, desiredEndISO);
  const modeMatch = !isOffline === liveHasMeet;
  const locMatch = isOffline ? (live.location ?? '') === (s.offline_location ?? '') : true;

  if (timeMatch && modeMatch && locMatch) {
    return { action: 'noop', eventId: priorEventId, meetLink: priorMeet };
  }

  // 5a. Time-only drift (mode/meet/location already correct) → patch; keeps the Meet,
  //     one clean "updated" notification, no cancel/new pair.
  if (modeMatch && locMatch && !timeMatch) {
    const pr = await rescheduleEvent(priorEventId, start, duration, coachEmail);
    if (!pr.success) {
      return { action: 'skipped', eventId: priorEventId, meetLink: priorMeet, error: pr.error };
    }
    const meet = isOffline ? null : (priorMeet ?? pr.meetLink ?? null);
    await attachCalendarLink(supabase, s.id, priorEventId, meet);
    return { action: 'patched', eventId: priorEventId, meetLink: meet };
  }

  // 5b. Mode/meet/location drift on an EXCLUSIVE event → delete + create (the only
  //     reliable way to add/remove conferenceData; e.g. online→offline strips Meet).
  await deleteCalendarEvent(priorEventId, coachEmail);
  return createNew('recreated');
}
