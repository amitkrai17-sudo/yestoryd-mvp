// ============================================================
// Handler: SLOT_SELECTION — Offer discovery call time slots
// Queries real coach availability, sends WhatsApp interactive list
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { sendList, sendText } from '@/lib/whatsapp/cloud-api';
import { getAvailableSlots } from '@/lib/whatsapp/agent/slots';
import type { ConversationState } from '@/lib/whatsapp/types';

type TypedClient = SupabaseClient<Database>;

export interface SlotSelectionResult {
  response: string;
  nextState: ConversationState;
  escalated: boolean;
}

export async function handleSlotSelection(
  phone: string,
  conversationId: string,
  collectedData: Record<string, unknown>,
  leadScore: number,
  supabase: TypedClient
): Promise<SlotSelectionResult> {
  const slots = await getAvailableSlots(supabase);

  // --- No slots available → escalate ---
  if (slots.length === 0) {
    const noSlotsMsg =
      `Our coaches are fully booked this week! Let me connect you with our team to find a time that works. 📅`;

    await sendText(phone, noSlotsMsg);

    return {
      response: noSlotsMsg,
      nextState: 'ESCALATED',
      escalated: true,
    };
  }

  // --- Build WhatsApp interactive list ---
  const childName = (collectedData.child_name as string) || 'your child';

  const body =
    `Choose a time that works best for your free discovery call about ${childName}'s reading journey.\n\n` +
    `It's 15-20 minutes on Google Meet — completely free! 🎯`;

  const rows = slots.map(s => ({
    id: s.slotId,
    title: s.displayText,
    description: '30-min free Google Meet call',
  }));

  await sendList(
    phone,
    body,
    'Pick a Time',
    [{ title: '📅 Available Times', rows }],
    { header: 'When works for your free call?' }
  );

  return {
    response: body,
    nextState: 'SLOT_SELECTION',
    escalated: false,
  };
}
