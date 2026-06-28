// ============================================================
// FILE: lib/whatsapp/handlers/coach-session-confirm.ts
// PURPOSE: Handle a coach's quick-reply tap on coach_session_confirm_v1.
//   Inbound interactiveId is the per-send payload csc_<action>:<sessionId>
//   (Graph-API-registered template echoes our developer payload, VERIFIED live).
//   Flow: parse → authorize the tapper as the session's coach → call the
//   canonical writer transitionSessionStatus → one-line WhatsApp reply.
//
// Dispatched from app/api/whatsapp/process/route.ts when interactiveId starts
// with 'csc_'. Authorization is CALLER-SIDE: the writer assumes none, so this
// handler MUST verify the inbound phone owns the session's coach before any
// transition. Comms failures never throw out of the handler (mirror house rule:
// a messaging error must not break the inbound flow).
// ============================================================

import { randomUUID } from 'crypto';
import { sendText } from '../cloud-api';
import { createAdminClient } from '@/lib/supabase/admin';
import { transitionSessionStatus } from '@/lib/scheduling/transition-session-status';
import { getPhoneLookupVariants, normalizePhone } from '@/lib/utils/phone';

type ActionKey = 'csc_yes' | 'csc_no' | 'csc_noshow';
const VALID_ACTIONS: ReadonlySet<string> = new Set(['csc_yes', 'csc_no', 'csc_noshow']);
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['completed', 'cancelled', 'missed']);

export async function handleCoachSessionConfirm(
  interactiveId: string,
  phone: string,
  messageId: string | null,
  requestId: string,
): Promise<void> {
  try {
    // 1. PARSE — csc_<action>:<sessionId>
    const sepIdx = interactiveId.indexOf(':');
    const actionKey = sepIdx >= 0 ? interactiveId.slice(0, sepIdx) : interactiveId;
    const sessionId = sepIdx >= 0 ? interactiveId.slice(sepIdx + 1) : '';
    if (!VALID_ACTIONS.has(actionKey) || !sessionId) {
      console.warn(JSON.stringify({
        requestId,
        event: 'wa_coach_session_confirm_malformed',
        interactiveId,
      }));
      return; // malformed internal payload — no reply
    }
    const action = actionKey as ActionKey;

    const supabase = createAdminClient();

    // 2. LOAD SESSION
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('id, coach_id, child_id, status')
      .eq('id', sessionId)
      .maybeSingle();

    if (!session) {
      await sendText(phone, "Sorry, we couldn't find that class.");
      return;
    }

    // 3. AUTHORIZE — the inbound phone must own this session's coach.
    let coachPhone: string | null = null;
    if (session.coach_id) {
      const { data: coach } = await supabase
        .from('coaches')
        .select('phone')
        .eq('id', session.coach_id)
        .maybeSingle();
      coachPhone = coach?.phone ?? null;
    }

    const authorized =
      !!coachPhone &&
      (getPhoneLookupVariants(phone).includes(coachPhone) ||
        normalizePhone(phone) === normalizePhone(coachPhone));

    if (!authorized) {
      console.warn(JSON.stringify({
        requestId,
        event: 'wa_coach_session_confirm_unauthorized',
        sessionId,
        coachId: session.coach_id,
      }));
      await sendText(phone, "Sorry, we couldn't verify this request.");
      return; // do NOT leak session details on auth-fail
    }

    // 4. CHILD NAME (first word) — fallback 'the' so replies still read.
    let childFirst = 'the';
    if (session.child_id) {
      const { data: child } = await supabase
        .from('children')
        .select('child_name, name')
        .eq('id', session.child_id)
        .maybeSingle();
      const full = (child?.child_name || child?.name || '').trim();
      const first = full.split(/\s+/)[0];
      if (first) childFirst = first;
    }

    // 5. IDEMPOTENCY PRE-CHECK — already terminal → reflect, don't re-transition.
    if (session.status && TERMINAL_STATUSES.has(session.status)) {
      await sendText(phone, `Already recorded — ${childFirst}'s class is marked ${session.status}.`);
      return;
    }

    // 6. TRANSITION — Q3-exact shapes (actor:'coach', fresh requestId).
    let result: Awaited<ReturnType<typeof transitionSessionStatus>>;
    if (action === 'csc_yes') {
      result = await transitionSessionStatus({
        sessionId,
        to: 'completed',
        actor: 'coach',
        requestId: randomUUID(),
        opts: { sessionsDelivered: 1, actorLabel: session.coach_id || 'coach' },
      });
    } else if (action === 'csc_no') {
      result = await transitionSessionStatus({
        sessionId,
        to: 'cancelled',
        actor: 'coach',
        reason: 'Coach confirmed via WhatsApp: class did not happen',
        disposition: 'coach_cancelled',
        requestId: randomUUID(),
        opts: {
          notify: false,
          extraSessionFields: { coach_notes: 'Coach confirmed class did not happen (WhatsApp)' },
        },
      });
    } else {
      result = await transitionSessionStatus({
        sessionId,
        to: 'missed',
        actor: 'coach',
        reason: 'Coach confirmed via WhatsApp: child did not attend',
        requestId: randomUUID(),
        opts: { sessionsDelivered: 1, actorLabel: session.coach_id || 'coach' },
      });
    }

    // 7. REPLY
    if (result.ok && !result.noop) {
      const okMsg: Record<ActionKey, string> = {
        csc_yes: `Recorded — ${childFirst}'s class is marked complete. Thank you!`,
        csc_no: `Recorded — ${childFirst}'s class won't be counted. Thanks for letting us know.`,
        csc_noshow: `Recorded — ${childFirst} marked absent for this class. Thank you!`,
      };
      await sendText(phone, okMsg[action]);
    } else {
      // noop (already terminal) or illegal transition — reflect the live status.
      const finalStatus = (result.noop ? result.to : (result.from ?? session.status)) ?? 'updated';
      await sendText(phone, `Already recorded — ${childFirst}'s class is marked ${finalStatus}.`);
    }

    // 8. LOG
    console.log(JSON.stringify({
      requestId,
      event: 'wa_coach_session_confirm',
      action: actionKey,
      sessionId,
      ok: result.ok,
      noop: !!result.noop,
      wa_message_id: messageId,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      requestId,
      event: 'wa_coach_session_confirm_error',
      error: err instanceof Error ? err.message : String(err),
    }));
    try {
      await sendText(phone, 'Sorry, something went wrong. Please try again or contact support.');
    } catch {
      /* comms failure must not throw out of the handler */
    }
  }
}
