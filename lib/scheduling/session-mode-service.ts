// ============================================================
// FILE: lib/scheduling/session-mode-service.ts
// PURPOSE: Single source of truth for a session's ONLINE/OFFLINE mode and its
//   online Meet link.
//   - resolveOnlineLink(): SOLE link-resolution logic (explicit → existing →
//     room → generated). No DB writes, no WhatsApp.
//   - setSessionMode(): SOLE mode/link write path + the mode-change WhatsApp
//     notifications (added in STEP 3).
//   No second link path or direct AiSensy/Meta call may exist elsewhere.
// ============================================================

import { scheduleCalendarEvent, updateCalendarEventForMode, getEventDetails } from '@/lib/calendar/events';
import { getServiceSupabase } from '@/lib/api-auth';
import { sendNotification, type NotifyResult } from '@/lib/communication/notify';
import { formatDateShort, formatTime12 } from '@/lib/utils/date-format';

type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

export type OnlineLinkSource = 'explicit' | 'existing' | 'room' | 'generated' | 'patched' | 'pending';

/** The scheduled_sessions fields resolveOnlineLink needs. */
export interface SessionForLink {
  id: string;
  session_type: string | null;
  session_number: number | null;
  google_meet_link: string | null;
  google_event_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
}

/** Resolution context — caller supplies what it has; steps are tried in order. */
export interface ResolveLinkContext {
  /** Step 1: an explicit link the caller already holds (override / known room). */
  explicitLink?: string | null;
  /** Step 3: a persistent batch/classroom room link (tuition_onboarding.meet_link). */
  roomLink?: string | null;
  /** For step 4 (generation): */
  childName?: string | null;
  coachEmail?: string | null;
  parentEmail?: string | null;
  /** When true, never reach step 4 (no calendar event creation) — used at session
   *  birth to avoid N calendar API calls in the batch loop. Returns source 'pending'. */
  noGenerate?: boolean;
}

export interface ResolveLinkResult {
  link: string | null;
  source: OnlineLinkSource;
  /** Set only when source==='generated' — the new calendar event id, for persistence. */
  calendarEventId?: string | null;
}

/**
 * SOLE link-resolution logic for an online session. No DB writes and no WhatsApp;
 * the only side effect is a Google Calendar event creation in step 4 (the SAME
 * helper the legacy switch-to-online path used). Order:
 *   1. explicit  — caller-supplied link
 *   2. existing  — session.google_meet_link already on the row
 *   3. room      — persistent batch/classroom room link
 *   4. generated — create a Calendar event + Meet link
 */
export async function resolveOnlineLink(
  session: SessionForLink,
  ctx: ResolveLinkContext = {},
): Promise<ResolveLinkResult> {
  // 1. explicit
  if (ctx.explicitLink) return { link: ctx.explicitLink, source: 'explicit' };

  // 2. existing on the row
  if (session.google_meet_link) return { link: session.google_meet_link, source: 'existing' };

  // 3. persistent room (batch / classroom)
  if (ctx.roomLink) return { link: ctx.roomLink, source: 'room' };

  // No-generate (born-online parity): never create a calendar event here. The row
  // stays online-pending; a later switch/reminder resolves it lazily.
  if (ctx.noGenerate) return { link: null, source: 'pending' };

  // 4a. Reuse an EXISTING calendar event (no orphan): patch its mode metadata and
  //     return its Meet link if it already has one. updateCalendarEventForMode does
  //     not create conferenceData, so a linkless existing event falls through to 4b.
  //     getEventDetails only READS the link — link generation stays in scheduleCalendarEvent.
  if (session.google_event_id) {
    try {
      if (ctx.coachEmail) {
        await updateCalendarEventForMode(session.google_event_id, ctx.coachEmail, 'online');
      }
      const details = await getEventDetails(session.google_event_id, ctx.coachEmail || undefined);
      const d = details as { hangoutLink?: string; conferenceData?: { entryPoints?: { uri?: string }[] } } | null;
      const existingLink = d?.hangoutLink || d?.conferenceData?.entryPoints?.[0]?.uri || null;
      if (existingLink) {
        return { link: existingLink, source: 'patched', calendarEventId: session.google_event_id };
      }
    } catch {
      // fall through to 4b — create a fresh event
    }
  }

  // 4b. generate via Calendar (same helper as the legacy switch-to-online path)
  const duration = session.duration_minutes || 45;
  const startTime = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + duration);

  const attendees = [ctx.parentEmail, ctx.coachEmail].filter((e): e is string => !!e);

  // The calendar helper's sessionType union is 'coaching' | 'parent_checkin' (no
  // 'tuition') and it does NOT branch on the value internally — but derive it from
  // the real session_type rather than hardcoding 'coaching'. The true type is carried
  // in the event title.
  const calendarSessionType: 'coaching' | 'parent_checkin' =
    session.session_type === 'parent_checkin' ? 'parent_checkin' : 'coaching';

  const calResult = await scheduleCalendarEvent(
    {
      title: `Yestoryd ${session.session_type || 'coaching'} - ${ctx.childName || 'Student'} (Session ${session.session_number || ''})`,
      description: `Reading session for ${ctx.childName || 'Student'} — online`,
      startTime,
      endTime,
      attendees,
      sessionType: calendarSessionType,
    },
    ctx.coachEmail || undefined,
  );

  return {
    link: calResult.meetLink || null,
    source: 'generated',
    calendarEventId: calResult.eventId || null,
  };
}

// ============================================================
// setSessionMode — SOLE mode/link write path + mode-change WhatsApp
// ============================================================

export interface SetSessionModeOpts {
  actor: 'coach' | 'admin';
  reason?: string;
  /** Optional explicit link override (step 1 of resolveOnlineLink). */
  explicitLink?: string | null;
  requestId?: string;
  /** Optional pre-built service client; one is created if absent. */
  supabase?: ServiceSupabase;
  /** Skip the COACH notification (parent still notified). Used for batch siblings
   *  so the single coach gets exactly one message, not one per child. */
  suppressCoachNotify?: boolean;
}

export interface SetSessionModeResult {
  ok: boolean;
  mode: 'online' | 'offline';
  link: string | null;
  linkSource?: OnlineLinkSource;
  notified: { parent: string; coach: string };
  noop?: boolean;
  error?: string;
}

function notifyStatus(r: PromiseSettledResult<NotifyResult>): string {
  if (r.status !== 'fulfilled') return 'failed';
  return r.value.success ? 'sent' : (r.value.reason ?? 'failed');
}

/**
 * SOLE write path for a session's mode + online link, and the SOLE sender of the
 * mode-change WhatsApp templates. Guarantees: an ONLINE session is persisted with a
 * resolved link before any notify, and a notify NEVER fires with an empty link.
 */
export async function setSessionMode(
  sessionId: string,
  mode: 'online' | 'offline',
  opts: SetSessionModeOpts,
): Promise<SetSessionModeResult> {
  const supabase = opts.supabase ?? getServiceSupabase();
  const requestId = opts.requestId ?? 'setSessionMode';

  // 1. Load session
  const { data: session, error: sErr } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, coach_id, batch_id, session_mode, status, session_type, session_number, scheduled_date, scheduled_time, duration_minutes, google_meet_link, google_event_id')
    .eq('id', sessionId)
    .single();

  if (sErr || !session) {
    return { ok: false, mode, link: null, notified: { parent: 'skipped', coach: 'skipped' }, error: 'session_not_found' };
  }

  // 2. Idempotent no-op: already in target mode AND (offline OR a link is present).
  //    An online session WITHOUT a link is NOT a no-op — it falls through to repair.
  const alreadyThere = session.session_mode === mode && (mode === 'offline' || !!session.google_meet_link);
  if (alreadyThere) {
    return { ok: true, mode, link: session.google_meet_link ?? null, notified: { parent: 'noop', coach: 'noop' }, noop: true };
  }

  // ── OFFLINE ──
  if (mode === 'offline') {
    const { error: uErr } = await supabase
      .from('scheduled_sessions')
      .update({ session_mode: 'offline', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (uErr) {
      return { ok: false, mode, link: session.google_meet_link ?? null, notified: { parent: 'skipped', coach: 'skipped' }, error: 'update_failed' };
    }

    // Notify the parent of the flip via parent_offline_notification_v3. Legacy
    // Pattern-A (no DB derivations) — pass already-first-worded values directly.
    // Required vars (DB-verified): parent_first, child_first, session_date.
    // Comms failure must NOT break the committed mode write. No coach offline
    // template exists, so the coach is not notified on offline flips.
    let parentNotified = 'skipped';
    try {
      const { data: child } = session.child_id
        ? await supabase.from('children').select('child_name, parent_name, parent_phone').eq('id', session.child_id).single()
        : { data: null };
      if (child?.parent_phone) {
        const firstWord = (s?: string | null) => (s ?? '').trim().split(/\s+/)[0] || '';
        const offlineRes = await sendNotification('parent_offline_notification_v3', child.parent_phone, {
          parent_first: firstWord(child.parent_name) || 'Parent',
          child_first: firstWord(child.child_name) || 'your child',
          session_date: session.scheduled_date ? formatDateShort(session.scheduled_date) : '',
        }, {
          triggeredBy: opts.actor,
          contextType: 'session_mode_change',
          contextId: sessionId,
        });
        parentNotified = offlineRes.success ? 'sent' : (offlineRes.reason ?? 'failed');
      }
    } catch (e) {
      console.warn(JSON.stringify({ requestId, event: 'session_offline_notify_error', sessionId, error: e instanceof Error ? e.message : String(e) }));
      parentNotified = 'failed';
    }

    return { ok: true, mode: 'offline', link: session.google_meet_link ?? null, notified: { parent: parentNotified, coach: 'no_offline_template' } };
  }

  // ── ONLINE ──
  const [{ data: child }, { data: coach }] = await Promise.all([
    session.child_id
      ? supabase.from('children').select('child_name, parent_name, parent_phone, parent_email').eq('id', session.child_id).single()
      : Promise.resolve({ data: null } as { data: null }),
    session.coach_id
      ? supabase.from('coaches').select('name, phone, email').eq('id', session.coach_id).single()
      : Promise.resolve({ data: null } as { data: null }),
  ]);

  // Persistent batch/classroom room link (step 3 of resolveOnlineLink).
  let roomLink: string | null = null;
  if (session.batch_id) {
    const { data: room } = await supabase
      .from('tuition_onboarding')
      .select('meet_link')
      .eq('batch_id', session.batch_id)
      .not('meet_link', 'is', null)
      .limit(1)
      .maybeSingle();
    roomLink = room?.meet_link ?? null;
  }

  const resolved = await resolveOnlineLink(session as SessionForLink, {
    explicitLink: opts.explicitLink,
    roomLink,
    childName: child?.child_name ?? null,
    coachEmail: coach?.email ?? null,
    parentEmail: child?.parent_email ?? null,
  });

  const wasOnline = session.session_mode === 'online';

  // FIX A — FRESH flip with no resolvable link → do NOT mint a linkless online row.
  // Leave mode unchanged so the caller/UI surfaces the failure.
  if (!resolved.link && !wasOnline) {
    console.warn(JSON.stringify({ requestId, event: 'session_online_link_unavailable_no_flip', sessionId, source: resolved.source }));
    return { ok: false, mode: 'online', link: null, notified: { parent: 'skipped', coach: 'skipped' }, error: 'link_unavailable' };
  }

  // Persist mode + link (+ event id when generated) in ONE update.
  const update: Record<string, unknown> = {
    session_mode: 'online',
    updated_at: new Date().toISOString(),
  };
  if (resolved.link) update.google_meet_link = resolved.link;
  if (resolved.source === 'generated' && resolved.calendarEventId) update.google_event_id = resolved.calendarEventId;

  const { error: uErr } = await supabase
    .from('scheduled_sessions')
    .update(update)
    .eq('id', sessionId);
  if (uErr) {
    return { ok: false, mode: 'online', link: resolved.link, linkSource: resolved.source, notified: { parent: 'skipped', coach: 'skipped' }, error: 'update_failed' };
  }

  // FIX A — REPAIR of an already-online row that still has no link → persisted as-is,
  // skip WA (never notify with an empty link).
  if (!resolved.link) {
    console.warn(JSON.stringify({ requestId, event: 'session_online_repair_no_link', sessionId }));
    return { ok: true, mode: 'online', link: null, linkSource: 'pending', notified: { parent: 'no_link', coach: 'no_link' } };
  }

  // Notify parent + coach with the GUARANTEED link. Canonical Pattern B names
  // (derivations produce parent_first_name / coach_first_name). Comms failure
  // must not break the (already-committed) mode write.
  const formattedDate = session.scheduled_date ? formatDateShort(session.scheduled_date) : '';
  const formattedTime = session.scheduled_time ? formatTime12(session.scheduled_time.slice(0, 5)) : '';
  const parentPromise: Promise<NotifyResult> = child?.parent_phone
    ? sendNotification('parent_session_mode_changed_v1', child.parent_phone, {
        parent_name: child.parent_name || 'Parent',
        child_name: child.child_name || 'your child',
        session_date: formattedDate,
        session_time: formattedTime,
        meet_link: resolved.link,
      }, {
        triggeredBy: opts.actor,
        contextType: 'session_mode_change',
        contextId: sessionId,
      })
    : Promise.resolve({ success: false, reason: 'phone_not_found' } as NotifyResult);

  const coachPromise: Promise<NotifyResult> = (!opts.suppressCoachNotify && coach?.phone)
    ? sendNotification('coach_session_mode_online_v1', coach.phone, {
        coach_name: coach.name || 'Coach',
        child_name: child?.child_name || 'your student',
        session_date: formattedDate,
        session_time: formattedTime,
        meet_link: resolved.link,
      }, {
        triggeredBy: opts.actor,
        contextType: 'session_mode_change',
        contextId: sessionId,
      })
    : Promise.resolve({ success: false, reason: opts.suppressCoachNotify ? 'suppressed' : 'phone_not_found' } as NotifyResult);

  let parentStatus = 'failed';
  let coachStatus = 'failed';
  try {
    const [pS, cS] = await Promise.allSettled([parentPromise, coachPromise]);
    parentStatus = notifyStatus(pS);
    coachStatus = opts.suppressCoachNotify ? 'suppressed' : notifyStatus(cS);
  } catch (waErr) {
    console.error(JSON.stringify({ requestId, event: 'session_mode_wa_error', sessionId, error: waErr instanceof Error ? waErr.message : String(waErr) }));
  }

  return {
    ok: true,
    mode: 'online',
    link: resolved.link,
    linkSource: resolved.source,
    notified: { parent: parentStatus, coach: coachStatus },
  };
}
