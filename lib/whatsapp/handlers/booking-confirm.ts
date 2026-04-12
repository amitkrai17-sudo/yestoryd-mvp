// ============================================================
// Handler: BOOKING_CONFIRM — Book discovery call from slot selection
// Parses slot ID, calls /api/discovery/book internally, sends confirmation
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { sendText } from '@/lib/whatsapp/cloud-api';
import { normalizePhone } from '@/lib/utils/phone';
import { parseSlotId, formatSlotLong, invalidateSlotCache } from '@/lib/whatsapp/agent/slots';
import { handleSlotSelection } from './slot-selection';
import type { ConversationState } from '@/lib/whatsapp/types';

type TypedClient = SupabaseClient<Database>;

export interface BookingConfirmResult {
  response: string;
  nextState: ConversationState;
  success: boolean;
  discoveryCallId?: string;
}

export async function handleBookingConfirm(
  phone: string,
  conversationId: string,
  collectedData: Record<string, unknown>,
  leadScore: number,
  selectedSlotId: string,
  supabase: TypedClient
): Promise<BookingConfirmResult> {
  // 1. Parse slot ID
  const parsed = parseSlotId(selectedSlotId);
  if (!parsed) {
    console.error(JSON.stringify({
      event: 'agent2_booking_invalid_slot_id',
      slotId: selectedSlotId,
    }));
    // Re-offer slots
    const fallback = await handleSlotSelection(phone, conversationId, collectedData, leadScore, supabase);
    return { response: fallback.response, nextState: fallback.nextState, success: false };
  }

  const { date, time } = parsed;

  // 2. Validate slot is still in the future (with 15 min buffer)
  // Slot times are IST — use +05:30 offset so the comparison with UTC "now" is correct
  const slotDateTime = new Date(`${date}T${time}:00+05:30`);
  const minBookingTime = new Date(Date.now() + 15 * 60 * 1000);
  if (slotDateTime < minBookingTime) {
    const expiredMsg = `Oops, that slot just passed! Let me find other available times...`;
    await sendText(phone, expiredMsg);
    invalidateSlotCache(); // Force fresh fetch — cached slots may all be stale
    const retry = await handleSlotSelection(phone, conversationId, collectedData, leadScore, supabase);
    return { response: retry.response, nextState: retry.nextState, success: false };
  }

  // 3. Get or create child record
  const childName = (collectedData.child_name as string)
    || (await getWaLeadField(supabase, phone, 'child_name'))
    || 'Child';
  const childAge = Number(collectedData.child_age)
    || (await getWaLeadField(supabase, phone, 'child_age'))
    || 8;
  const parentName = (collectedData.contact_name as string)
    || (collectedData.parent_name as string)
    || (await getWaLeadField(supabase, phone, 'parent_name'))
    || 'Parent';

  // Placeholder email for WhatsApp leads (booking API requires valid email)
  const normalized = normalizePhone(phone);
  const placeholderEmail = `${normalized}@wa.yestoryd.com`;

  let childId: string | null = null;

  // Check if wa_lead has a linked child
  const e164 = normalizePhone(phone);
  const noPlus = e164.replace(/^\+/, '');
  const digits10 = e164.slice(-10);

  const { data: waLead } = await supabase
    .from('wa_leads')
    .select('child_id')
    .or(`phone_number.eq.${noPlus},phone_number.eq.${e164},phone_number.eq.${digits10}`)
    .single();

  if (waLead?.child_id) {
    childId = waLead.child_id;
  } else {
    // Guard: avoid creating a duplicate child for a phone that already has
    // one on record (enrolled or in-progress). Reuses that child_id and
    // links it to wa_leads so future messages stay consistent.
    const { data: existingChild } = await supabase
      .from('children')
      .select('id')
      .or(`parent_phone.eq.${e164},parent_phone.eq.${noPlus},parent_phone.eq.${digits10}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingChild?.id) {
      console.warn(JSON.stringify({
        event: 'agent2_booking_skipped_duplicate_child',
        phone,
        existing_child_id: existingChild.id,
      }));
      childId = existingChild.id;

      // Link to wa_lead so the lookup hits on next turn
      await supabase
        .from('wa_leads')
        .update({ child_id: childId })
        .eq('phone_number', phone);
    } else {
    // Create minimal child record
    const { data: newChild, error: childError } = await supabase
      .from('children')
      .insert({
        name: childName,
        age: typeof childAge === 'number' ? childAge : Number(childAge),
        parent_name: parentName,
        parent_phone: normalized,
        parent_email: placeholderEmail,
        lead_status: 'lead',
        lead_source: 'whatsapp_agent',
        parent_concerns: (collectedData.reading_concerns as string) || null,
      })
      .select('id')
      .single();

    if (childError) {
      console.error(JSON.stringify({
        event: 'agent2_booking_child_create_error',
        error: childError.message,
        phone,
      }));
    } else if (newChild) {
      childId = newChild.id;

      // Link child to wa_lead
      await supabase
        .from('wa_leads')
        .update({ child_id: childId })
        .eq('phone_number', phone);
    }
    }
  }

  // 4. Call the booking API internally
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      || 'http://localhost:3000';

    const bookingResponse = await fetch(`${baseUrl}/api/discovery/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentName,
        parentEmail: placeholderEmail,
        parentPhone: phone,
        childName,
        childAge: typeof childAge === 'number' ? childAge : Number(childAge),
        childId,
        slotDate: date,
        slotTime: time,
        source: 'agent_2_whatsapp',
      }),
    });

    const bookingData = await bookingResponse.json();

    // Handle "already booked" as success
    if (bookingData.code === 'ALREADY_BOOKED') {
      const alreadyMsg =
        `You already have a discovery call scheduled!\n\n` +
        `We'll send you a reminder before the call. Looking forward to helping ${childName}!`;
      await sendText(phone, alreadyMsg);

      return {
        response: alreadyMsg,
        nextState: 'BOOKED',
        success: true,
        discoveryCallId: bookingData.existingBookingId,
      };
    }

    if (!bookingData.success) {
      console.error(JSON.stringify({
        event: 'agent2_booking_api_error',
        error: bookingData.error,
        phone,
        slot: `${date} ${time}`,
      }));

      // Slot was taken or API error — re-offer slots
      const takenMsg = `Oops, that slot was just taken! Let me find other available times...`;
      await sendText(phone, takenMsg);

      invalidateSlotCache();
      const retry = await handleSlotSelection(phone, conversationId, collectedData, leadScore, supabase);
      return { response: retry.response, nextState: retry.nextState, success: false };
    }

    // 5. SUCCESS — send confirmation
    const displayDate = formatSlotLong(date, time);
    const coachInfo = bookingData.coach?.assigned
      ? `Coach: ${bookingData.coach.name}`
      : `A coach will be assigned shortly`;

    const confirmMsg =
      `Your free discovery call is booked!\n\n` +
      `${displayDate}\n` +
      `${coachInfo}\n` +
      `Via Google Meet (link will be in your calendar invite)\n\n` +
      `You'll get a reminder 1 hour before. Looking forward to helping ${childName}!`;

    await sendText(phone, confirmMsg);

    // 6. Update wa_leads and wa_lead_conversations
    const discoveryCallId = bookingData.booking?.id;

    await Promise.all([
      supabase
        .from('wa_leads')
        .update({
          status: 'discovery_booked',
          discovery_call_id: discoveryCallId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('phone_number', phone),
      supabase
        .from('wa_lead_conversations')
        .update({
          discovery_call_id: discoveryCallId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId),
    ]);

    // 7. Invalidate slot cache
    invalidateSlotCache();

    return {
      response: confirmMsg,
      nextState: 'BOOKED',
      success: true,
      discoveryCallId,
    };
  } catch (error) {
    console.error(JSON.stringify({
      event: 'agent2_booking_exception',
      error: error instanceof Error ? error.message : 'Unknown error',
      phone,
      slot: `${date} ${time}`,
    }));

    const errorMsg = `Something went wrong with the booking. Let me find other available times...`;
    await sendText(phone, errorMsg);

    invalidateSlotCache();
    const retry = await handleSlotSelection(phone, conversationId, collectedData, leadScore, supabase);
    return { response: retry.response, nextState: retry.nextState, success: false };
  }
}

// ============================================================
// Helper: Get a field from wa_leads by phone
// ============================================================

async function getWaLeadField(
  supabase: TypedClient,
  phone: string,
  field: string
): Promise<any> {
  const { data } = await supabase
    .from('wa_leads')
    .select(field)
    .eq('phone_number', phone)
    .single();
  return data?.[field as keyof typeof data] ?? null;
}
