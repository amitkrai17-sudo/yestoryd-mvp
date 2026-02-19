// ============================================================
// FILE: app/api/jobs/progress-pulse/route.ts
// PURPOSE: QStash background job — generate & deliver Progress Pulse report
// FLOW: Session complete → queueProgressPulse → THIS JOB
//   1. Fetch last N session learning_events
//   2. Generate report via Gemini
//   3. Save as learning_event (event_type: 'progress_pulse')
//   4. Deliver via WhatsApp + Email
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateProgressPulse } from '@/lib/gemini/client';
import { saveProgressPulseToLearningEvents } from '@/lib/learningEvents';
import { sendCommunication } from '@/lib/communication';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// QStash signature verification (same pattern as process-session)
async function verifyQStashSignature(
  request: NextRequest,
  body: string
): Promise<{ isValid: boolean; error?: string }> {
  if (process.env.NODE_ENV === 'development') {
    return { isValid: true };
  }

  const signature = request.headers.get('upstash-signature');
  if (!signature) {
    return { isValid: false, error: 'Missing upstash-signature header' };
  }

  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey) {
    return { isValid: false, error: 'Server configuration error' };
  }

  const keysToTry = [currentSigningKey, nextSigningKey].filter(Boolean) as string[];

  for (const key of keysToTry) {
    try {
      const [timestamp, providedSignature] = signature.split('.');
      const timestampMs = parseInt(timestamp) * 1000;
      if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
        continue;
      }
      const toSign = `${timestamp}.${body}`;
      const expectedSignature = crypto
        .createHmac('sha256', key)
        .update(toSign)
        .digest('base64');
      if (providedSignature === expectedSignature) {
        return { isValid: true };
      }
    } catch {
      continue;
    }
  }

  return { isValid: false, error: 'Invalid signature' };
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Verify QStash signature
    const bodyText = await request.text();
    const { isValid, error: sigError } = await verifyQStashSignature(request, bodyText);
    if (!isValid) {
      console.error(`[ProgressPulse:${requestId}] Signature verification failed:`, sigError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(bodyText);
    const {
      enrollmentId,
      childId,
      childName,
      coachId,
      completedCount,
      pulseInterval,
      parentPhone,
      parentEmail,
      parentName,
    } = payload;

    console.log(JSON.stringify({
      requestId,
      event: 'progress_pulse_start',
      enrollmentId,
      childId,
      childName,
      completedCount,
      pulseInterval,
    }));

    const supabase = createAdminClient();

    // 1. Fetch last N session learning_events for this child
    const { data: sessionEvents, error: eventsError } = await supabase
      .from('learning_events')
      .select('event_data, event_date, ai_summary')
      .eq('child_id', childId)
      .eq('event_type', 'session')
      .order('event_date', { ascending: false })
      .limit(pulseInterval);

    if (eventsError) {
      console.error(`[ProgressPulse:${requestId}] Failed to fetch session events:`, eventsError);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    if (!sessionEvents || sessionEvents.length === 0) {
      console.warn(`[ProgressPulse:${requestId}] No session events found for child ${childId}`);
      return NextResponse.json({ success: true, skipped: true, reason: 'No session data' });
    }

    // 2. Build session summary for Gemini
    const sessionsSummary = sessionEvents
      .reverse() // chronological order
      .map((event, i) => {
        const ed = event.event_data as Record<string, any> | null;
        if (!ed) return `Session ${i + 1}: ${event.ai_summary || 'No details available'}`;
        return [
          `Session ${ed.session_number || i + 1}:`,
          `  Focus: ${ed.focus_area || 'N/A'}`,
          `  Skills: ${(ed.skills_worked_on || []).join(', ') || 'N/A'}`,
          `  Progress: ${ed.progress_rating || 'N/A'}`,
          `  Engagement: ${ed.engagement_level || 'N/A'}`,
          `  Highlights: ${(ed.highlights || []).join(', ') || 'N/A'}`,
          `  Challenges: ${(ed.challenges || []).join(', ') || 'N/A'}`,
          `  Next focus: ${ed.next_session_focus || 'N/A'}`,
          ed.coach_notes ? `  Coach notes: ${ed.coach_notes}` : '',
          ed.breakthrough_moment ? `  Breakthrough: ${ed.breakthrough_moment}` : '',
        ].filter(Boolean).join('\n');
      })
      .join('\n\n');

    // 3. Get child's age for age-appropriate report
    const { data: child } = await supabase
      .from('children')
      .select('dob, age')
      .eq('id', childId)
      .single();

    let age = 7; // fallback
    if (child?.dob) {
      const dob = new Date(child.dob);
      age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    } else if (child?.age) {
      age = child.age;
    }

    // 4. Calculate pulse number (how many pulses have been sent so far)
    const { count: previousPulses } = await supabase
      .from('learning_events')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('event_type', 'progress_pulse');

    const pulseNumber = (previousPulses || 0) + 1;

    // 5. Generate Progress Pulse via Gemini
    console.log(JSON.stringify({
      requestId,
      event: 'generating_pulse',
      sessionCount: sessionEvents.length,
      pulseNumber,
      age,
    }));

    const pulseReport = await generateProgressPulse(
      childName,
      age,
      sessionsSummary,
      completedCount,
      pulseNumber
    );

    // 6. Save to learning_events
    const savedEvent = await saveProgressPulseToLearningEvents(
      childId,
      {
        pulse_number: pulseNumber,
        completed_sessions: completedCount,
        overall_progress: pulseReport.overall_progress,
        confidence_trend: pulseReport.confidence_trend,
        headline: pulseReport.headline,
        parent_summary: pulseReport.parent_summary,
        strengths: pulseReport.strengths,
        focus_areas: pulseReport.focus_areas,
        home_activities: pulseReport.home_activities,
        coach_notes: pulseReport.coach_notes,
        milestone_reached: pulseReport.milestone_reached,
        enrollment_id: enrollmentId,
      },
      coachId
    );

    console.log(JSON.stringify({
      requestId,
      event: 'pulse_saved',
      learningEventId: savedEvent.id,
      pulseNumber,
    }));

    // 7. Deliver via communication engine (non-blocking)
    try {
      // Build a formatted strengths list for the message
      const strengthsText = pulseReport.strengths.map(s => `• ${s}`).join('\n');
      const activitiesText = pulseReport.home_activities.map(a => `• ${a}`).join('\n');

      await sendCommunication({
        templateCode: 'progress_pulse_report',
        recipientType: 'parent',
        recipientPhone: parentPhone,
        recipientEmail: parentEmail,
        recipientName: parentName,
        variables: {
          child_name: childName,
          parent_name: parentName || 'Parent',
          pulse_number: String(pulseNumber),
          headline: pulseReport.headline,
          parent_summary: pulseReport.parent_summary,
          overall_progress: pulseReport.overall_progress,
          confidence_trend: pulseReport.confidence_trend,
          strengths: strengthsText,
          home_activities: activitiesText,
          completed_sessions: String(completedCount),
          milestone: pulseReport.milestone_reached || '',
        },
        relatedEntityType: 'learning_event',
        relatedEntityId: savedEvent.id,
      });

      console.log(JSON.stringify({
        requestId,
        event: 'pulse_delivered',
        channels: ['whatsapp', 'email'],
      }));
    } catch (commError) {
      // Communication failure should not fail the job — pulse is already saved
      console.error(`[ProgressPulse:${requestId}] Communication delivery failed:`, commError);
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'progress_pulse_complete',
      duration,
      pulseNumber,
      childName,
    }));

    return NextResponse.json({
      success: true,
      pulseNumber,
      learningEventId: savedEvent.id,
      headline: pulseReport.headline,
    });
  } catch (error) {
    console.error(`[ProgressPulse:${requestId}] Job failed:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
