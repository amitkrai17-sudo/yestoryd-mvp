// app/api/webhooks/aisensy/goals/route.ts
// Webhook handler for WhatsApp replies to goals capture message (P7)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/utils/phone';
import { WHATSAPP_GOAL_MAPPING, isValidGoal } from '@/lib/constants/goals';

export const dynamic = 'force-dynamic';

/**
 * AiSensy webhook payload structure (incoming message)
 */
interface AiSensyWebhookPayload {
  from?: string;         // Phone number that sent the message
  text?: string;         // Message text
  messageId?: string;    // Unique message ID
  timestamp?: string;    // Message timestamp
  type?: string;         // Message type (text, image, etc.)
  // Additional fields may vary
}

export async function POST(request: NextRequest) {
  try {
    const payload: AiSensyWebhookPayload = await request.json();

    console.log('[Goals Webhook] Received:', JSON.stringify(payload));

    const { from, text } = payload;

    // Validate required fields
    if (!from || !text) {
      console.log('[Goals Webhook] Missing from or text, ignoring');
      return NextResponse.json({ status: 'ignored', reason: 'missing_fields' });
    }

    // Normalize phone number
    const phone = normalizePhone(from);
    if (!phone) {
      console.log('[Goals Webhook] Invalid phone number:', from);
      return NextResponse.json({ status: 'ignored', reason: 'invalid_phone' });
    }

    // Parse goal numbers from reply (e.g., "1,3" or "1 3" or "1, 3" or "1,2,3")
    const numbers = text.match(/[1-5]/g);
    if (!numbers || numbers.length === 0) {
      // Not a goals reply (might be a regular message), ignore silently
      console.log('[Goals Webhook] No goal numbers found in:', text);
      return NextResponse.json({ status: 'ignored', reason: 'no_goal_numbers' });
    }

    // Map numbers to goal IDs, deduplicate
    const uniqueNumbers = Array.from(new Set(numbers));
    const goals = uniqueNumbers
      .map(n => WHATSAPP_GOAL_MAPPING[n])
      .filter(g => g && isValidGoal(g));

    if (goals.length === 0) {
      console.log('[Goals Webhook] No valid goals mapped from numbers:', numbers);
      return NextResponse.json({ status: 'no_valid_goals' });
    }

    console.log('[Goals Webhook] Mapped goals:', goals);

    // Find child by parent phone (most recent child with assessment)
    const { data: child, error: fetchError } = await supabaseAdmin
      .from('children')
      .select('id, parent_goals, goals_captured_at, goals_capture_method, name')
      .eq('parent_phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[Goals Webhook] Error fetching child:', fetchError);
      return NextResponse.json({ status: 'error', error: fetchError.message }, { status: 500 });
    }

    if (!child) {
      console.log('[Goals Webhook] No child found for phone:', phone);
      return NextResponse.json({ status: 'child_not_found' });
    }

    console.log('[Goals Webhook] Found child:', child.name, child.id);

    // Merge with existing goals (don't overwrite)
    const existingGoals: string[] = child.parent_goals || [];
    const mergedGoals = Array.from(new Set([...existingGoals, ...goals]));

    // Update child record
    // Only update capture method/time if this is the first capture
    const { error: updateError } = await supabaseAdmin
      .from('children')
      .update({
        parent_goals: mergedGoals,
        goals_captured_at: child.goals_captured_at || new Date().toISOString(),
        goals_capture_method: child.goals_capture_method || 'whatsapp',
      })
      .eq('id', child.id);

    if (updateError) {
      console.error('[Goals Webhook] Error updating child:', updateError);
      return NextResponse.json({ status: 'error', error: updateError.message }, { status: 500 });
    }

    console.log('[Goals Webhook] Successfully saved goals for child:', child.name, mergedGoals);

    return NextResponse.json({
      status: 'success',
      childId: child.id,
      childName: child.name,
      goals: mergedGoals,
      newGoals: goals,
    });

  } catch (error) {
    console.error('[Goals Webhook] Exception:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handle GET requests (AiSensy may send verification requests)
export async function GET(request: NextRequest) {
  // Return 200 to confirm webhook is active
  return NextResponse.json({ status: 'ok', message: 'Goals webhook active' });
}
