// ============================================================
// FILE: lib/whatsapp/handlers/renewal-intent.ts
// PURPOSE: Handle parent quick-reply button taps from
//          parent_renewal_intent_v1 (BATCH-3-INBOUND).
//
// Dispatched from app/api/whatsapp/process/route.ts when an
// inbound message has interactiveId starting with 'btn_renew_'.
// Reaches here only when sender is an enrolled parent.
//
// Flow:
//   1. Map button payload → decision enum
//   2. Find enrollment awaiting decision (parent_renewal_check_sent_at
//      set, parent_renewal_decision_at not set)
//   3. Update enrollment with decision + timestamp
//   4. Write learning_events row (RAG signal)
//   5. Send free-form ack (within 24h window, free)
//   6. activity_log row
//   7. For 'talk_to_coach' → fire coach_parent_callback_request_v1
// ============================================================

import { sendText } from '../cloud-api';
import { sendNotification } from '@/lib/communication/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildPhoneOrFilter } from '@/lib/utils/phone';
import type { EnrolledChild } from '../enrolled-parent-lookup';

type RenewalDecision = 'yes_renew' | 'pause_for_now' | 'talk_to_coach';

const RESPONSE_MAP: Record<string, RenewalDecision> = {
  btn_renew_yes:   'yes_renew',
  btn_renew_pause: 'pause_for_now',
  btn_renew_talk:  'talk_to_coach',
};

interface EnrollmentAwaiting {
  id: string;
  child_id: string | null;
  coach_id: string | null;
  sessions_remaining: number | null;
}

interface ParentRow {
  id: string;
  name: string | null;
}

export async function handleRenewalIntent(
  interactiveId: string,
  phone: string,
  children: EnrolledChild[],
  messageId: string | null,
): Promise<void> {
  const decision = RESPONSE_MAP[interactiveId];
  if (!decision) return; // safety: unknown btn_renew_* payload

  const supabase = createAdminClient();

  // 1. Resolve parent by phone (need parent.id + name for activity_log + ack)
  const { data: parent } = await supabase
    .from('parents')
    .select('id, name')
    .or(buildPhoneOrFilter('phone', phone))
    .limit(1)
    .maybeSingle() as { data: ParentRow | null };

  // 2. Find enrollment awaiting the parent's renewal decision
  const childIds = children.map((c) => c.id);
  const { data: enrollmentData } = await supabase
    .from('enrollments')
    .select('id, child_id, coach_id, sessions_remaining, parent_renewal_check_sent_at, parent_renewal_decision_at')
    .in('child_id', childIds)
    .not('parent_renewal_check_sent_at', 'is', null)
    .is('parent_renewal_decision_at', null)
    .order('parent_renewal_check_sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const enrollment = enrollmentData as EnrollmentAwaiting | null;

  if (!enrollment || !enrollment.child_id) {
    // Defensive: button tap but no awaiting enrollment found (or orphan with null child_id).
    await sendText(phone, "Thanks for the response! Coach will reach out shortly.");
    await supabase.from('activity_log').insert({
      action: 'renewal_intent_orphan',
      user_email: 'system',
      user_type: 'system',
      metadata: {
        parent_id: parent?.id ?? null,
        phone,
        interactive_id: interactiveId,
        wa_message_id: messageId,
      },
    });
    return;
  }

  // 3. Update enrollment with parent's decision
  await supabase
    .from('enrollments')
    .update({
      parent_renewal_decision: decision,
      parent_renewal_decision_at: new Date().toISOString(),
    })
    .eq('id', enrollment.id);

  // Resolve child + coach details from the EnrolledChild[] in scope
  const matchedChild = children.find((c) => c.id === enrollment.child_id) ?? null;
  const childName = matchedChild?.child_name || matchedChild?.name || 'your child';
  const coachName = matchedChild?.coachName ?? 'your coach';

  // 4. learning_events row (RAG signal)
  await supabase.from('learning_events').insert({
    child_id: enrollment.child_id,
    event_type: 'parent_renewal_decision',
    event_date: new Date().toISOString().split('T')[0],
    event_data: {
      decision,
      sessions_remaining_at_response: enrollment.sessions_remaining,
      enrollment_id: enrollment.id,
      wa_message_id: messageId,
    },
    signal_source: 'parent_whatsapp',
    signal_confidence: 'high',
    content_for_embedding: `Parent renewal decision: ${decision} for ${childName}`,
  });

  // 5. Free-form ack reply (within 24h window opened by parent's tap; no template needed)
  const coachFirstName = coachName.split(/\s+/)[0] || 'your coach';
  const ackMap: Record<RenewalDecision, string> = {
    yes_renew:     `Great! Here's the renewal link: https://www.yestoryd.com/parent/topup/${enrollment.id}`,
    pause_for_now: `Got it. We'll hold things and check in next week. Reply anytime when you're ready to resume.`,
    talk_to_coach: `Coach ${coachFirstName} will reach out within 24 hours.`,
  };
  await sendText(phone, ackMap[decision]);

  // 6. activity_log
  await supabase.from('activity_log').insert({
    action: 'parent_renewal_decision',
    user_email: parent?.name ?? phone,
    user_type: 'parent',
    metadata: {
      parent_id: parent?.id ?? null,
      enrollment_id: enrollment.id,
      child_id: enrollment.child_id,
      decision,
    },
  });

  // 7. talk_to_coach → notify the coach via WhatsApp template
  if (decision === 'talk_to_coach' && enrollment.coach_id) {
    const { data: coach } = await supabase
      .from('coaches')
      .select('id, name, phone')
      .eq('id', enrollment.coach_id)
      .single();

    if (coach?.phone) {
      await sendNotification('coach_parent_callback_request_v1', coach.phone, {
        coach_name:   coach.name ?? 'Coach',
        parent_name:  parent?.name ?? 'Parent',
        child_name:   childName,
        parent_phone: phone,
      }, {
        contextType: 'enrollment',
        contextId: enrollment.id,
      });
    }
  }
}
