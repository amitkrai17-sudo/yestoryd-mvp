// ============================================================
// Handler: RESCHEDULE — Cancel existing booking and re-offer slots
// Finds active discovery call, cancels it (DB + Calendar), re-offers slots
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { sendText } from '@/lib/whatsapp/cloud-api';
import { invalidateSlotCache } from '@/lib/whatsapp/agent/slots';
import { handleSlotSelection } from './slot-selection';
import { cancelDiscoveryCall } from '@/lib/googleCalendar';
import type { ConversationState } from '@/lib/whatsapp/types';

type TypedClient = SupabaseClient<Database>;

export interface RescheduleResult {
  response: string;
  nextState: ConversationState;
  cancelledCallId: string | null;
}

export async function handleReschedule(
  phone: string,
  conversationId: string,
  collectedData: Record<string, unknown>,
  leadScore: number,
  supabase: TypedClient
): Promise<RescheduleResult> {
  // 1. Find active discovery call for this lead
  const { data: waLead } = await supabase
    .from('wa_leads')
    .select('id, discovery_call_id')
    .eq('phone_number', phone)
    .single();

  let discoveryCallId = waLead?.discovery_call_id || null;

  // Fallback: query discovery_calls by parent phone if wa_leads doesn't have it
  if (!discoveryCallId) {
    const { data: dcByPhone } = await supabase
      .from('discovery_calls')
      .select('id')
      .eq('parent_phone', phone)
      .in('status', ['scheduled', 'pending', 'assigned'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    discoveryCallId = dcByPhone?.id || null;
  }

  // 2. No active booking — offer to schedule fresh
  if (!discoveryCallId) {
    const noBookingMsg =
      `I don't see an active booking for you. No worries — let's schedule a discovery call! 😊`;
    await sendText(phone, noBookingMsg);

    const slotResult = await handleSlotSelection(
      phone, conversationId, collectedData, leadScore, supabase
    );

    return {
      response: `${noBookingMsg}\n\n${slotResult.response}`,
      nextState: slotResult.nextState,
      cancelledCallId: null,
    };
  }

  // 3. Fetch the discovery call details
  const { data: discoveryCall } = await supabase
    .from('discovery_calls')
    .select('id, status, google_calendar_event_id')
    .eq('id', discoveryCallId)
    .single();

  if (!discoveryCall || discoveryCall.status === 'cancelled' || discoveryCall.status === 'completed' || discoveryCall.status === 'converted') {
    // Already cancelled/completed — just offer new slots
    const alreadyMsg =
      `Looks like your previous booking is no longer active. Let's find a new time! 😊`;
    await sendText(phone, alreadyMsg);

    const slotResult = await handleSlotSelection(
      phone, conversationId, collectedData, leadScore, supabase
    );

    return {
      response: `${alreadyMsg}\n\n${slotResult.response}`,
      nextState: slotResult.nextState,
      cancelledCallId: null,
    };
  }

  // 4. Cancel the discovery call
  // 4a. Update DB status
  await supabase
    .from('discovery_calls')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', discoveryCallId);

  // 4b. Cancel Google Calendar event if one exists
  if (discoveryCall.google_calendar_event_id) {
    try {
      await cancelDiscoveryCall(discoveryCall.google_calendar_event_id, 'Rescheduled by parent via WhatsApp');
    } catch (err) {
      console.error(JSON.stringify({
        event: 'reschedule_calendar_cancel_error',
        discoveryCallId,
        eventId: discoveryCall.google_calendar_event_id,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }

  // 4c. Clear discovery_call_id from wa_leads and wa_lead_conversations
  await Promise.all([
    supabase
      .from('wa_leads')
      .update({
        discovery_call_id: null,
        status: 'qualified',
        updated_at: new Date().toISOString(),
      })
      .eq('phone_number', phone),
    supabase
      .from('wa_lead_conversations')
      .update({
        discovery_call_id: null,
        current_state: 'SLOT_SELECTION',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId),
  ]);

  // 4d. Update lead_lifecycle to qualified (ready for rebooking)
  if (waLead?.id) {
    await supabase
      .from('lead_lifecycle')
      .update({ current_state: 'qualified' })
      .eq('wa_lead_id', waLead.id);
  }

  // 4e. Invalidate slot cache
  invalidateSlotCache();

  // 4f. Log to agent_actions
  await supabase.from('agent_actions').insert({
    action_type: 'reschedule',
    wa_lead_id: waLead?.id || null,
    reasoning: `Parent requested reschedule — cancelled discovery call ${discoveryCallId}`,
    outcome: 'success',
    confidence_score: 1.0,
  });

  // 5. Send cancellation confirmation
  const cancelMsg =
    `No problem at all! I've cancelled your previous booking. Let's find a better time 😊`;
  await sendText(phone, cancelMsg);

  // 6. Immediately re-offer slots
  const slotResult = await handleSlotSelection(
    phone, conversationId, collectedData, leadScore, supabase
  );

  return {
    response: `${cancelMsg}\n\n${slotResult.response}`,
    nextState: slotResult.nextState,
    cancelledCallId: discoveryCallId,
  };
}
