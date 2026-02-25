// ============================================================
// FILE: app/api/cron/group-class-insights/route.ts
// ============================================================
// QStash-verified cron: generates micro-insights via Gemini
// for each child who attended a group class session.
// Insights are personalized based on enrollment status and
// attendance history (non-enrolled CTAs evolve over time).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbedding } from '@/lib/rai/embeddings';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const getSupabase = createAdminClient;

const getReceiver = () => new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Validation ───

const payloadSchema = z.object({
  session_id: z.string().uuid(),
  ratings: z.array(z.object({
    childId: z.string().uuid(),
    childName: z.string(),
    engagement: z.string(),
    skillTags: z.array(z.string()),
    note: z.string().optional(),
  })),
  newly_earned_badges: z.array(z.object({
    child_id: z.string(),
    child_name: z.string(),
    badge_name: z.string(),
  })),
  class_type_name: z.string(),
  session_date: z.string(),
});

// ─── Auth Verification ───

async function verifyAuth(request: NextRequest, body: string): Promise<{ isValid: boolean; source: string }> {
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = getReceiver();
      const isValid = await receiver.verify({ signature, body });
      if (isValid) return { isValid: true, source: 'qstash' };
    } catch (e) {
      console.error('[group-class-insights] QStash verification failed:', e);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn('[group-class-insights] Development mode - skipping signature verification');
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// ─── Attendance-based CTA bucket ───

function getCtaBucket(attendanceCount: number): { ctaType: string; systemSuffix: string } {
  if (attendanceCount <= 2) {
    return {
      ctaType: 'assessment',
      systemSuffix: 'End with: "A personalized reading assessment can help us understand [child]\'s full reading profile." Include a link prompt: [Take Free Assessment]',
    };
  }
  if (attendanceCount <= 4) {
    return {
      ctaType: 'soft_assessment',
      systemSuffix: 'End with a softer CTA: "Want to understand [child]\'s complete reading pattern?" Do NOT be pushy.',
    };
  }
  if (attendanceCount <= 7) {
    return {
      ctaType: 'portal',
      systemSuffix: 'End with: "See [child]\'s learning journey so far →" Reference their growing participation history.',
    };
  }
  return {
    ctaType: 'coaching',
    systemSuffix: 'Reference how peers with similar engagement have benefited from personalized coaching. End with a gentle coaching CTA.',
  };
}

// ─── Main Handler ───

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const body = await request.text();
    const auth = await verifyAuth(request, body);

    if (!auth.isValid) {
      console.error(JSON.stringify({ requestId, event: 'group_class_insights_auth_failed' }));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let parsed: z.infer<typeof payloadSchema>;
    try {
      parsed = payloadSchema.parse(JSON.parse(body));
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { session_id, ratings, newly_earned_badges, class_type_name, session_date } = parsed;
    const supabase = getSupabase();

    console.log(JSON.stringify({ requestId, event: 'group_class_insights_start', sessionId: session_id, childCount: ratings.length }));

    let insightsGenerated = 0;

    for (const rating of ratings) {
      try {
        // (a) Gather context

        // Check enrollment status
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id, status')
          .eq('child_id', rating.childId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        const isEnrolled = !!enrollment;

        // Attendance count for this child
        const { count: attendanceCount } = await supabase
          .from('group_session_participants')
          .select('id', { count: 'exact', head: true })
          .eq('child_id', rating.childId)
          .eq('attendance_status', 'present');

        const totalAttendance = attendanceCount || 1;

        // Typed responses from this session
        const { data: typedResponses } = await supabase
          .from('learning_events')
          .select('event_data')
          .eq('child_id', rating.childId)
          .eq('event_type', 'group_class_response')
          .filter('event_data->>session_id', 'eq', session_id)
          .limit(3);

        const typedResponseText = (typedResponses || [])
          .map(r => {
            const data = r.event_data as Record<string, unknown> | null;
            return data?.response_text || '';
          })
          .filter(Boolean)
          .join('; ');

        // Coaching context for enrolled children
        let coachingContext = '';
        if (isEnrolled) {
          const { data: recentSessions } = await supabase
            .from('learning_events')
            .select('ai_summary')
            .eq('child_id', rating.childId)
            .eq('event_type', 'session')
            .order('event_date', { ascending: false })
            .limit(3);

          coachingContext = (recentSessions || [])
            .map(s => s.ai_summary)
            .filter(Boolean)
            .join(' | ');
        }

        // Badges earned by this child
        const childBadges = newly_earned_badges
          .filter(b => b.child_id === rating.childId)
          .map(b => b.badge_name);

        // (b) Generate insight via Gemini

        let systemPrompt: string;
        let userPrompt: string;
        let maxTokens: number;

        if (isEnrolled) {
          systemPrompt = `You are Yestoryd's reading intelligence assistant. Generate a warm, brief insight (2-3 sentences) for a parent about their child's group class participation. Be specific about what was observed. If a badge was earned, celebrate it. Reference how this connects to their coaching journey if coaching context is provided. Keep it encouraging but honest.`;

          userPrompt = [
            `Child: ${rating.childName}`,
            `Class: ${class_type_name} on ${session_date}`,
            `Engagement: ${rating.engagement}`,
            rating.skillTags.length > 0 ? `Skills observed: ${rating.skillTags.join(', ')}` : '',
            rating.note ? `Instructor notes: ${rating.note}` : '',
            typedResponseText ? `Written response: ${typedResponseText}` : '',
            coachingContext ? `Recent coaching: ${coachingContext}` : '',
            childBadges.length > 0 ? `Badges earned today: ${childBadges.join(', ')}` : '',
          ].filter(Boolean).join('\n');

          maxTokens = 200;
        } else {
          const { ctaType, systemSuffix } = getCtaBucket(totalAttendance);

          systemPrompt = `You are Yestoryd's reading intelligence assistant. Generate a warm, genuine insight (2-3 sentences) for a parent about their child's group class participation. Be specific about what was observed. Do NOT be pushy or salesy — be genuinely insightful about the child's learning. ${systemSuffix}`;

          userPrompt = [
            `Child: ${rating.childName}`,
            `Class: ${class_type_name} on ${session_date}`,
            `Engagement: ${rating.engagement}`,
            rating.skillTags.length > 0 ? `Skills observed: ${rating.skillTags.join(', ')}` : '',
            rating.note ? `Instructor notes: ${rating.note}` : '',
            typedResponseText ? `Written response: ${typedResponseText}` : '',
            childBadges.length > 0 ? `Badges earned today: ${childBadges.join(', ')}` : '',
            `Total classes attended: ${totalAttendance}`,
            `CTA type: ${ctaType}`,
          ].filter(Boolean).join('\n');

          maxTokens = 250;
        }

        let insightText: string;
        try {
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-lite',
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
          });

          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: { role: 'model', parts: [{ text: systemPrompt }] },
          });

          insightText = result.response.text().trim();
        } catch (geminiErr) {
          console.error(JSON.stringify({ requestId, event: 'gemini_insight_failed', childId: rating.childId, error: geminiErr instanceof Error ? geminiErr.message : 'Unknown' }));
          // Fallback insight
          insightText = `${rating.childName} participated in today's ${class_type_name} with ${rating.engagement} engagement.${childBadges.length > 0 ? ` Congratulations on earning the ${childBadges.join(' and ')} badge!` : ''}`;
        }

        // (c) Store micro-insight as learning_event

        let insightEmbedding: number[] | null = null;
        try {
          insightEmbedding = await generateEmbedding(insightText);
        } catch (embErr) {
          console.error(JSON.stringify({ requestId, event: 'insight_embedding_failed', childId: rating.childId, error: embErr instanceof Error ? embErr.message : 'Unknown' }));
        }

        const { ctaType } = isEnrolled ? { ctaType: 'none' } : getCtaBucket(totalAttendance);

        await supabase.from('learning_events').insert({
          child_id: rating.childId,
          event_type: 'group_class_micro_insight',
          event_date: new Date().toISOString(),
          event_data: {
            session_id,
            insight_text: insightText,
            attendance_count: totalAttendance,
            is_enrolled: isEnrolled,
            badges_earned: childBadges,
            cta_type: ctaType,
          },
          content_for_embedding: insightText,
          embedding: insightEmbedding ? JSON.stringify(insightEmbedding) : null,
          ai_summary: insightText.substring(0, 300),
        });

        insightsGenerated++;
        console.log(JSON.stringify({ requestId, event: 'insight_generated', childId: rating.childId, enrolled: isEnrolled, attendance: totalAttendance }));

      } catch (err) {
        console.error(JSON.stringify({ requestId, event: 'insight_child_error', childId: rating.childId, error: err instanceof Error ? err.message : 'Unknown' }));
      }
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'group_class_insights_done', sessionId: session_id, insightsGenerated, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, insights_generated: insightsGenerated });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'group_class_insights_error', error: message }));
    return NextResponse.json({ success: false, requestId, error: message }, { status: 500 });
  }
}
