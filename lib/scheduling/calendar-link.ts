// ============================================================
// FILE: lib/scheduling/calendar-link.ts
// PURPOSE: ONE pure-write helper to persist a session's Google Calendar event id
//   + Meet link. No calendar API calls, no link resolution, no WhatsApp — just the
//   { google_event_id, google_meet_link, updated_at } update by session id.
//   Shared by the calendar-ATTACH paths in lib/scheduling/ that are NOT mode
//   changes (session create + reschedule). ONLINE/OFFLINE mode changes (and the
//   link RESOLUTION they need) go through setSessionMode / resolveOnlineLink in
//   session-mode-service.ts instead — this helper does not resolve, only persists.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Persist a session's calendar event id + Meet link. Pure DB write — accepts null
 * for either field (no-calendar / partial paths) and always bumps updated_at.
 * Returns { ok:false, error } on a db error, else { ok:true }.
 */
export async function attachCalendarLink(
  supabase: AdminClient,
  sessionId: string,
  eventId: string | null,
  meetLink: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('scheduled_sessions')
    .update({
      google_event_id: eventId,
      google_meet_link: meetLink,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Set-variant of attachCalendarLink: persist the SAME event id + Meet link onto a
 * SET of sessions in ONE write (`.in('id', sessionIds)`). Mirrors attachCalendarLink's
 * shape/error handling exactly and likewise bumps updated_at. No-op safe on an empty
 * array (returns ok without a DB call). Like the single-row variant it WRITES whatever
 * it is given (including null) — a caller preserving a column must pass that column's
 * existing value.
 */
export async function attachCalendarLinkToSet(
  supabase: AdminClient,
  sessionIds: string[],
  eventId: string | null,
  meetLink: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (sessionIds.length === 0) return { ok: true };

  const { error } = await supabase
    .from('scheduled_sessions')
    .update({
      google_event_id: eventId,
      google_meet_link: meetLink,
      updated_at: new Date().toISOString(),
    })
    .in('id', sessionIds);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
