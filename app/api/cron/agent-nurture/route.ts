// ============================================================
// FILE: app/api/cron/agent-nurture/route.ts
// ============================================================
// Nurture Sequence Cron Job
// Runs every 2 hours via QStash to:
// 1. Enroll silent leads into nurture sequences
// 2. Send timed, personalized messages
// 3. Detect 24h window expiry and skip gracefully
//
// QStash Schedule:
//   cron: "0 */2 * * *"  (Every 2 hours)
//   url: /api/cron/agent-nurture
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { Receiver } from '@upstash/qstash';
import { sendText } from '@/lib/whatsapp/cloud-api';
import { formatForWhatsApp } from '@/lib/utils/phone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import { getGeminiModel } from '@/lib/gemini-config';
import { getPricingConfig, getPerWeekPrice } from '@/lib/config/pricing-config';

export const dynamic = 'force-dynamic';

// ============================================================
// SEQUENCE DEFINITIONS
// ============================================================

interface SequenceConfig {
  steps: number[];
  days: number[];
  finalState: string;
}

const SEQUENCES: Record<string, SequenceConfig> = {
  post_assessment: {
    steps: [0, 1, 2, 3, 4],
    days: [0, 3, 7, 14, 30],
    finalState: 'cold',
  },
  post_conversation: {
    steps: [0, 1, 2, 3],
    days: [0, 3, 7, 14],
    finalState: 'cold',
  },
  post_discovery: {
    steps: [0, 1, 2],
    days: [0, 7, 14],
    finalState: 'cold',
  },
};

// ============================================================
// MESSAGE TEMPLATES
// ============================================================

function getStaticMessage(
  sequence: string,
  step: number,
  vars: { parentName: string; childName: string; childAge: number | null; concern: string | null },
  perWeek: number
): string | null {
  const name = vars.parentName || 'there';
  const child = vars.childName || 'your child';

  if (sequence === 'post_assessment') {
    switch (step) {
      case 0:
        return `Hi ${name}! 👋\n\nWe noticed you completed the reading assessment for ${child}. The results showed some interesting insights!\n\nWould you like to discuss them with one of our reading experts? It's a free 15-min call, no commitment.`;
      case 1:
        return null; // Gemini tip — handled separately
      case 2:
        return `Hi ${name}, just checking in! 📚\n\nMany parents who took the assessment found that a single discovery call helped them understand exactly where their child stands.\n\nShall I set one up for ${child}? It's free and takes just 15 minutes.`;
      case 3:
        return `Hi ${name}! Our coaches have helped 100+ children improve their reading confidence.\n\nOne parent told us: "After just 4 sessions, my daughter started reading on her own!"\n\nWant to see how we can help ${child} too?`;
      case 4:
        return `Hi ${name}, this is our last follow-up! 🙏\n\nIf you ever want to explore reading coaching for ${child}, we're here. Just reply "Hi" anytime and we'll pick up where we left off.\n\nWishing ${child} happy reading! 📖`;
    }
  }

  if (sequence === 'post_conversation') {
    switch (step) {
      case 0:
        return `Hi ${name}! 👋\n\nWe had a great chat earlier. If you'd like to take the next step, our free 3-minute reading assessment can give you a clear picture of where ${child} stands.\n\nShall I send you the link?`;
      case 1:
        return null; // Gemini tip — handled separately
      case 2:
        return `Hi ${name}! Quick thought 💡\n\nDid you know that children who get early reading support show 2x faster improvement? Our personalized coaching starts at just ₹${perWeek}/week.\n\nWant to try a free discovery call to see if it's right for ${child}?`;
      case 3:
        return `Hi ${name}, just a final check-in! 🙏\n\nWe're here whenever you're ready to explore reading support for ${child}. Just reply "Hi" and we'll help you get started.\n\nHappy reading! 📚`;
    }
  }

  if (sequence === 'post_discovery') {
    switch (step) {
      case 0:
        return `Hi ${name}! 🎉\n\nGreat news — your discovery call gave us wonderful insights about ${child}'s reading journey.\n\nWould you like to know more about how our coaching program works? We have flexible plans starting at ₹${perWeek}/week.`;
      case 1:
        return `Hi ${name}! Just wanted to share — parents who start coaching within a week of their discovery call see the fastest results for their children.\n\nShall I help you pick a plan that works for ${child}?`;
      case 2:
        return `Hi ${name}, last message from us! 🙏\n\nWe loved meeting ${child} during the discovery call. If you'd like to start coaching anytime, just reply "Hi" — we'll take it from there.\n\nWishing ${child} a wonderful reading journey! 📖`;
    }
  }

  return null;
}

// ============================================================
// GEMINI TIP GENERATION (for step 1 in post_assessment & post_conversation)
// ============================================================

async function generateReadingTip(childAge: number | null, concern: string | null): Promise<string> {
  const age = childAge || 7;
  const topic = concern || 'reading skills';

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: getGeminiModel('content_generation'),
      generationConfig: { temperature: 0.7, maxOutputTokens: 100 },
    });

    const prompt = `Generate a 2-sentence reading tip for a ${age}-year-old child whose concern is ${topic}. Keep it actionable and warm. No links.`;
    const result = await model.generateContent(prompt);
    const tip = result.response.text().trim();

    if (tip && tip.length > 10) return tip;
  } catch (err) {
    console.error(JSON.stringify({
      event: 'nurture_gemini_error',
      error: err instanceof Error ? err.message : 'Unknown error',
    }));
  }

  // Static fallback
  return `Try reading aloud with your child for just 10 minutes a day — it builds both vocabulary and confidence! Pick a book they love and take turns reading pages.`;
}

// ============================================================
// AUTH VERIFICATION (matches daily-lead-digest pattern)
// ============================================================

async function verifyCronAuth(request: NextRequest, body?: string): Promise<{ isValid: boolean; source: string }> {
  // 1. Check CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isValid: true, source: 'cron_secret' };
  }

  // 2. Check internal API key
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 3. Check QStash signature
  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
      });

      const isValid = await receiver.verify({
        signature,
        body: body || '',
      });

      if (isValid) {
        return { isValid: true, source: 'qstash' };
      }
    } catch (e) {
      console.error('QStash verification failed:', e);
    }
  }

  return { isValid: false, source: 'none' };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. AUTHORIZATION
    const auth = await verifyCronAuth(request);
    if (!auth.isValid) {
      console.error(JSON.stringify({ requestId, event: 'nurture_auth_failed' }));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'agent_nurture_start',
      source: auth.source,
    }));

    const supabase = getServiceSupabase();
    const pricingConfig = await getPricingConfig();
    const perWeek = getPerWeekPrice(pricingConfig);
    const now = new Date().toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    // ============================================================
    // PHASE A: Enroll new leads into nurture sequences
    // ============================================================

    let enrolled = 0;

    // A1: assessed/qualified + silent >24h → post_assessment
    const { data: assessedLeads } = await supabase
      .from('lead_lifecycle')
      .select('id, wa_lead_id, current_state')
      .in('current_state', ['assessed', 'qualified'])
      .is('nurture_sequence', null)
      .lt('updated_at', twentyFourHoursAgo)
      .limit(10);

    if (assessedLeads?.length) {
      // Verify silence via wa_lead_conversations
      for (const lead of assessedLeads) {
        if (!lead.wa_lead_id) continue;
        const { data: conv } = await supabase
          .from('wa_lead_conversations')
          .select('id, last_message_at, is_bot_active')
          .eq('wa_lead_id', lead.wa_lead_id)
          .single();

        if (!conv || !conv.is_bot_active) continue;
        if (conv.last_message_at && conv.last_message_at > twentyFourHoursAgo) continue;

        const { error } = await supabase
          .from('lead_lifecycle')
          .update({
            nurture_sequence: 'post_assessment',
            nurture_step: 0,
            next_nurture_at: now,
            current_state: 'nurturing',
          })
          .eq('id', lead.id);

        if (!error) enrolled++;
      }
    }

    // A2: new/engaging/qualifying + silent >24h → post_conversation
    const { data: convLeads } = await supabase
      .from('lead_lifecycle')
      .select('id, wa_lead_id, current_state')
      .in('current_state', ['new', 'engaging', 'qualifying'])
      .is('nurture_sequence', null)
      .lt('updated_at', twentyFourHoursAgo)
      .limit(10);

    if (convLeads?.length) {
      for (const lead of convLeads) {
        if (!lead.wa_lead_id) continue;
        const { data: conv } = await supabase
          .from('wa_lead_conversations')
          .select('id, last_message_at, is_bot_active')
          .eq('wa_lead_id', lead.wa_lead_id)
          .single();

        if (!conv || !conv.is_bot_active) continue;
        if (conv.last_message_at && conv.last_message_at > twentyFourHoursAgo) continue;

        const { error } = await supabase
          .from('lead_lifecycle')
          .update({
            nurture_sequence: 'post_conversation',
            nurture_step: 0,
            next_nurture_at: now,
            current_state: 'nurturing',
          })
          .eq('id', lead.id);

        if (!error) enrolled++;
      }
    }

    // A3: booked + silent >72h → post_discovery
    const { data: bookedLeads } = await supabase
      .from('lead_lifecycle')
      .select('id, wa_lead_id, current_state')
      .eq('current_state', 'booked')
      .is('nurture_sequence', null)
      .lt('updated_at', seventyTwoHoursAgo)
      .limit(10);

    if (bookedLeads?.length) {
      for (const lead of bookedLeads) {
        if (!lead.wa_lead_id) continue;
        const { data: conv } = await supabase
          .from('wa_lead_conversations')
          .select('id, last_message_at, is_bot_active')
          .eq('wa_lead_id', lead.wa_lead_id)
          .single();

        if (!conv || !conv.is_bot_active) continue;
        if (conv.last_message_at && conv.last_message_at > seventyTwoHoursAgo) continue;

        const { error } = await supabase
          .from('lead_lifecycle')
          .update({
            nurture_sequence: 'post_discovery',
            nurture_step: 0,
            next_nurture_at: now,
            current_state: 'nurturing',
          })
          .eq('id', lead.id);

        if (!error) enrolled++;
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'nurture_enrollment_complete',
      enrolled,
    }));

    // ============================================================
    // PHASE B: Process due nurtures
    // ============================================================

    const { data: dueLeads } = await supabase
      .from('lead_lifecycle')
      .select(`
        id, wa_lead_id, current_state, nurture_sequence, nurture_step,
        next_nurture_at, child_name, child_age, parent_concerns, ai_lead_score
      `)
      .eq('current_state', 'nurturing')
      .not('nurture_sequence', 'is', null)
      .lte('next_nurture_at', now)
      .order('ai_lead_score', { ascending: false })
      .limit(20);

    let sent = 0;
    let skipped24h = 0;
    let errors = 0;

    if (dueLeads?.length) {
      for (const lead of dueLeads) {
        try {
          const sequence = lead.nurture_sequence!;
          const step = lead.nurture_step ?? 0;
          const seqConfig = SEQUENCES[sequence];

          if (!seqConfig) {
            console.error(JSON.stringify({
              requestId,
              event: 'nurture_unknown_sequence',
              lifecycleId: lead.id,
              sequence,
            }));
            continue;
          }

          // Get the lead's phone from wa_leads
          if (!lead.wa_lead_id) continue;

          const { data: waLead } = await supabase
            .from('wa_leads')
            .select('phone_number, parent_name')
            .eq('id', lead.wa_lead_id)
            .single();

          if (!waLead?.phone_number) continue;

          // Get conversation for this lead
          const { data: conv } = await supabase
            .from('wa_lead_conversations')
            .select('id, last_message_at')
            .eq('wa_lead_id', lead.wa_lead_id)
            .single();

          if (conv) {
            const { data: lastMsg } = await supabase
              .from('wa_lead_messages')
              .select('created_at')
              .eq('conversation_id', conv.id)
              .eq('direction', 'inbound')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (lastMsg?.created_at && lastMsg.created_at < twentyFourHoursAgo) {
              // TODO: Use AiSensy templates for leads outside 24h window
              console.log(JSON.stringify({
                requestId,
                event: 'nurture_skipped_24h_window',
                lifecycleId: lead.id,
                lastInbound: lastMsg.created_at,
              }));
              skipped24h++;
              continue;
            }
          }

          // Get message for this step
          const vars = {
            parentName: waLead.parent_name || 'there',
            childName: lead.child_name || 'your child',
            childAge: lead.child_age,
            concern: lead.parent_concerns?.[0] || null,
          };

          let message: string | null = getStaticMessage(sequence, step, vars, perWeek);

          // Step 1 in post_assessment and post_conversation uses Gemini tip
          if (message === null && step === 1 && (sequence === 'post_assessment' || sequence === 'post_conversation')) {
            const tip = await generateReadingTip(lead.child_age, lead.parent_concerns?.[0] || null);
            message = `Hi ${vars.parentName}! Here's a quick reading tip for ${vars.childName}: 📖\n\n${tip}\n\nWant more personalized guidance? Our reading coaches can create a custom plan for ${vars.childName}.`;
          }

          if (!message) {
            console.error(JSON.stringify({
              requestId,
              event: 'nurture_no_message',
              lifecycleId: lead.id,
              sequence,
              step,
            }));
            continue;
          }

          // Send the message
          const phone = formatForWhatsApp(waLead.phone_number);
          const sendResult = await sendText(phone, message);

          if (!sendResult.success) {
            console.error(JSON.stringify({
              requestId,
              event: 'nurture_send_failed',
              lifecycleId: lead.id,
              error: sendResult.error,
            }));
            errors++;
            continue;
          }

          // Update lifecycle: increment step or complete sequence
          const nextStep = step + 1;
          const isLastStep = nextStep >= seqConfig.steps.length;

          if (isLastStep) {
            // Final step sent — move to cold, clear nurture
            await supabase
              .from('lead_lifecycle')
              .update({
                current_state: seqConfig.finalState,
                nurture_sequence: null,
                nurture_step: 0,
                next_nurture_at: null,
              })
              .eq('id', lead.id);
          } else {
            // Compute next nurture time
            const currentDay = seqConfig.days[step];
            const nextDay = seqConfig.days[nextStep];
            const deltaDays = nextDay - currentDay;
            const nextNurtureAt = new Date(Date.now() + deltaDays * 24 * 60 * 60 * 1000).toISOString();

            await supabase
              .from('lead_lifecycle')
              .update({
                nurture_step: nextStep,
                next_nurture_at: nextNurtureAt,
              })
              .eq('id', lead.id);
          }

          // Log action
          await supabase.from('agent_actions').insert({
            action_type: 'ENTER_NURTURE',
            lead_lifecycle_id: lead.id,
            wa_lead_id: lead.wa_lead_id,
            reasoning: `${sequence} step ${step}${isLastStep ? ' (final)' : ''}`,
            outcome: 'success',
            confidence_score: 1.0,
          });

          // Save bot message in conversation
          if (conv) {
            await supabase.from('wa_lead_messages').insert({
              conversation_id: conv.id,
              direction: 'outbound',
              sender_type: 'bot',
              content: message,
              message_type: 'text',
              metadata: { nurture_sequence: sequence, nurture_step: step } as any,
            });
          }

          sent++;

          console.log(JSON.stringify({
            requestId,
            event: 'nurture_sent',
            lifecycleId: lead.id,
            sequence,
            step,
            isLastStep,
          }));
        } catch (err) {
          console.error(JSON.stringify({
            requestId,
            event: 'nurture_lead_error',
            lifecycleId: lead.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          }));
          errors++;
        }
      }
    }

    // ============================================================
    // AUDIT LOG
    // ============================================================

    try {
      await supabase.from('activity_log').insert({
        user_email: 'engage@yestoryd.com',
        user_type: 'system',
        action: 'agent_nurture_cron',
        metadata: {
          request_id: requestId,
          source: auth.source,
          enrolled,
          sent,
          skipped_24h: skipped24h,
          errors,
          due_count: dueLeads?.length || 0,
          timestamp: new Date().toISOString(),
        } as any,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'agent_nurture_complete',
      duration: `${duration}ms`,
      enrolled,
      sent,
      skipped_24h: skipped24h,
      errors,
      due_count: dueLeads?.length || 0,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      enrolled,
      sent,
      skipped_24h: skipped24h,
      errors,
      due_count: dueLeads?.length || 0,
      duration: `${duration}ms`,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'agent_nurture_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Support POST for QStash
export async function POST(request: NextRequest) {
  return GET(request);
}
