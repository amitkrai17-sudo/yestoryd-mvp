// file: app/api/sessions/parent-checkin/route.ts
// API endpoint for saving parent check-in session data
// Saves to scheduled_sessions + learning_events for RAG
// AUTO-TRIGGERS final assessment email after session 9 (last parent check-in)

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface ParentCheckinRequest {
  sessionId: string;
  coachId: string;
  childId: string;

  // Parent sentiment
  parentSentiment: string;
  parentSeesProgress: string;

  // Home practice
  homePracticeFrequency: string;
  homeHelpers: string[];

  // Concerns
  concernsRaised: string[];
  concernDetails?: string;
  actionItems?: string;

  // Follow-up and renewal
  followUpNeeded: boolean;
  followUpDate?: string;
  escalateToAdmin: boolean;
  renewalLikelihood: string;

  // Voice note
  voiceNote?: string;
}

// Transcribe voice note using Gemini
async function transcribeVoiceNote(audioBase64: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const audioData = audioBase64.split(',')[1] || audioBase64;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/webm',
          data: audioData,
        },
      },
      { text: 'Transcribe this voice note from a reading coach about a parent check-in session. Return only the transcription, no additional text.' },
    ]);

    return result.response.text().trim();
  } catch (error) {
    console.error('Voice transcription error:', error);
    return '';
  }
}

// Generate AI summary for the check-in
async function generateCheckinSummary(
  childName: string,
  parentName: string,
  data: ParentCheckinRequest,
  voiceTranscript?: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `
You are summarizing a parent check-in call for a children's reading coaching program.

Child: ${childName}
Parent: ${parentName}

Check-in Details:
- Parent Sentiment: ${data.parentSentiment}
- Parent sees improvement: ${data.parentSeesProgress}
- Home practice frequency: ${data.homePracticeFrequency}
- Who helps at home: ${data.homeHelpers.join(', ')}
- Concerns raised: ${data.concernsRaised.join(', ')}
${data.concernDetails ? `- Concern details: ${data.concernDetails}` : ''}
${data.actionItems ? `- Action items: ${data.actionItems}` : ''}
- Renewal likelihood: ${data.renewalLikelihood}
${data.followUpNeeded ? `- Follow-up needed: Yes (by ${data.followUpDate})` : ''}
${data.escalateToAdmin ? '- ESCALATED TO ADMIN' : ''}
${voiceTranscript ? `\nCoach's voice note: "${voiceTranscript}"` : ''}

Write a concise 2-3 sentence summary that captures:
1. Parent's overall satisfaction and perception of progress
2. Key points or concerns discussed
3. Next steps or action items

Be professional and factual. This will be stored for future reference.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Summary generation error:', error);
    // Fallback summary
    return `Parent check-in completed. Sentiment: ${data.parentSentiment}. Progress perceived: ${data.parentSeesProgress}. Home practice: ${data.homePracticeFrequency}. Renewal likelihood: ${data.renewalLikelihood}.`;
  }
}

// ==================== AUTO-TRIGGER FINAL ASSESSMENT ====================
async function checkAndTriggerFinalAssessment(childId: string): Promise<{
  triggered: boolean;
  enrollmentId?: string;
  message?: string;
}> {
  try {
    // Get enrollment for this child (includes V2 total_sessions)
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, status, parent_id, child_id, total_sessions')
      .eq('child_id', childId)
      .in('status', ['active', 'pending_start'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!enrollment) {
      return { triggered: false, message: 'No active enrollment found' };
    }

    // V2: Use enrollment.total_sessions, fallback to legacy 9
    const totalRequired = enrollment.total_sessions || 9; /* V1 fallback — will be replaced by age_band_config.total_sessions */

    // Count completed sessions for this child
    const { count: completedSessions } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('status', 'completed');

    // If not yet all sessions completed, don't trigger
    if ((completedSessions || 0) < totalRequired) {
      return {
        triggered: false,
        message: `${completedSessions}/${totalRequired} sessions completed`
      };
    }

    // Check if final assessment already sent
    const { data: existingEvent } = await supabase
      .from('enrollment_events')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .eq('event_type', 'final_assessment_sent')
      .single();

    if (existingEvent) {
      return { triggered: false, message: 'Final assessment already sent' };
    }

    // Get parent and child details
    const { data: child } = await supabase
      .from('children')
      .select('name, child_name, parent_email, parent_name')
      .eq('id', childId)
      .single();

    const { data: parent } = await supabase
      .from('parents')
      .select('email, name, phone')
      .eq('id', enrollment.parent_id!)
      .single();

    const parentEmail = parent?.email || child?.parent_email;
    const parentName = parent?.name || child?.parent_name || 'Parent';
    const childName = child?.name || child?.child_name || 'Student';
    const parentPhone = parent?.phone;

    if (!parentEmail) {
      return { triggered: false, message: 'No parent email found' };
    }

    // Generate final assessment link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';
    const assessmentLink = `${baseUrl}/assessment?type=final&enrollment=${enrollment.id}`;

    // Log the event
    await supabase.from('enrollment_events').insert({
      enrollment_id: enrollment.id,
      event_type: 'final_assessment_sent',
      event_data: {
        parent_email: parentEmail,
        child_name: childName,
        link: assessmentLink,
        sessions_completed: completedSessions,
        auto_triggered: true,
        sent_at: new Date().toISOString(),
      },
      triggered_by: 'system',
    });

    // Send email via Resend
    try {
      const { sendEmail } = require('@/lib/email/resend-client');

      await sendEmail({
        to: parentEmail,
        from: { email: 'engage@yestoryd.com', name: 'Yestoryd' },
        subject: `🎉 ${childName}'s Final Reading Assessment - See Their Amazing Progress!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #FF0099, #7B008B); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Congratulations!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">All Sessions Completed!</p>
            </div>
            
            <div style="background: #fff; padding: 30px; border: 1px solid #eee; border-top: none;">
              <p style="font-size: 16px; color: #333;">Hi ${parentName},</p>
              
              <p style="color: #555; line-height: 1.6;">
                <strong>${childName}</strong> has successfully completed all sessions of the reading program! 🌟
              </p>
              
              <p style="color: #555; line-height: 1.6;">
                It's time for the <strong>Final Assessment</strong> to measure how much they've improved. 
                This takes just 5 minutes and will help us create a beautiful progress report comparing 
                their reading skills from Day 1 to now.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${assessmentLink}" 
                   style="background: linear-gradient(to right, #FF0099, #7B008B); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 8px;
                          font-weight: bold;
                          font-size: 16px;
                          display: inline-block;">
                  📖 Take Final Assessment
                </a>
              </div>
              
              <div style="background: #FEF3C7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #92400E; font-size: 14px;">
                  <strong>What happens next?</strong><br>
                  After the assessment, you'll receive ${childName}'s official Completion Certificate 
                  with a detailed Progress Report showing their improvement! 🏆
                </p>
              </div>
              
              <p style="color: #888; font-size: 14px;">
                Questions? Reply to this email or WhatsApp us at 8976287997.
              </p>
              
              <p style="color: #555;">
                Best regards,<br>
                <strong>Team Yestoryd</strong>
              </p>
            </div>
            
            <div style="background: #f9f9f9; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #888; font-size: 12px;">
                Yestoryd • AI-Powered Reading Coaching for Kids
              </p>
            </div>
          </div>
        `,
      });

      console.log(`✅ Final assessment email sent to ${parentEmail} for ${childName}`);
    } catch (emailError) {
      console.error('Email send error:', emailError);
    }

    // Send WhatsApp via AiSensy (if phone available)
    if (parentPhone) {
      try {
        await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: process.env.AISENSY_API_KEY,
            campaignName: 'final_assessment_request',
            destination: parentPhone.replace(/\D/g, ''),
            userName: 'Yestoryd',
            templateParams: [childName, assessmentLink],
          }),
        });
        console.log(`✅ Final assessment WhatsApp sent to ${parentPhone}`);
      } catch (waError) {
        console.error('WhatsApp send error:', waError);
      }
    }

    return {
      triggered: true,
      enrollmentId: enrollment.id,
      message: `Final assessment sent to ${parentEmail}`,
    };

  } catch (error) {
    console.error('Auto-trigger error:', error);
    return { triggered: false, message: 'Error checking completion status' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: ParentCheckinRequest = await request.json();

    // Validate required fields
    if (!data.sessionId || !data.coachId || !data.childId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get child and parent info
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('name, parent_name')
      .eq('id', data.childId)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { error: 'Child not found' },
        { status: 404 }
      );
    }

    // Transcribe voice note if provided
    let voiceTranscript = '';
    if (data.voiceNote) {
      voiceTranscript = await transcribeVoiceNote(data.voiceNote);
    }

    // Generate AI summary
    const aiSummary = await generateCheckinSummary(
      child.name ?? 'Child',
      child.parent_name || 'Parent',
      data,
      voiceTranscript
    );

    // Update scheduled_sessions with check-in data
    const { error: sessionError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),

        // Parent check-in specific fields
        parent_sentiment: data.parentSentiment,
        parent_sees_progress: data.parentSeesProgress,
        home_practice_frequency: data.homePracticeFrequency,
        home_helpers: data.homeHelpers,
        concerns_raised: data.concernsRaised,
        concern_details: data.concernDetails || null,
        action_items: data.actionItems || null,
        follow_up_needed: data.followUpNeeded,
        follow_up_date: data.followUpDate || null,
        escalate_to_admin: data.escalateToAdmin,

        // Voice note
        voice_note_transcript: voiceTranscript || null,

        // AI summary (visible to coach/parent)
        ai_summary: aiSummary,

        updated_at: new Date().toISOString(),
      })
      .eq('id', data.sessionId);

    if (sessionError) {
      console.error('Session update error:', sessionError);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // Create learning_event for RAG
    const eventData = {
      session_type: 'parent_checkin',
      parent_sentiment: data.parentSentiment,
      parent_sees_progress: data.parentSeesProgress,
      home_practice_frequency: data.homePracticeFrequency,
      home_helpers: data.homeHelpers,
      concerns_raised: data.concernsRaised,
      concern_details: data.concernDetails || null,
      action_items: data.actionItems || null,
      renewal_likelihood: data.renewalLikelihood,
      follow_up_needed: data.followUpNeeded,
      escalated: data.escalateToAdmin,
      voice_transcript: voiceTranscript || null,
      ai_summary: aiSummary,
    };

    // Create content for embedding (searchable text)
    const contentForEmbedding = [
      `Parent check-in: ${data.parentSentiment}`,
      `Progress: ${data.parentSeesProgress}`,
      `Home practice: ${data.homePracticeFrequency}`,
      `Concerns: ${data.concernsRaised.join(', ')}`,
      data.concernDetails || '',
      data.actionItems || '',
      voiceTranscript || '',
      aiSummary,
    ].filter(Boolean).join(' ');

    const { error: eventError } = await supabase
      .from('learning_events')
      .insert({
        child_id: data.childId,
        coach_id: data.coachId,
        session_id: data.sessionId,
        event_type: 'session',
        event_subtype: 'parent_checkin',
        event_data: eventData,
        ai_summary: aiSummary,
        voice_note_transcript: voiceTranscript || null,
        content_for_embedding: contentForEmbedding,
        created_at: new Date().toISOString(),
      });

    if (eventError) {
      console.error('Event creation error:', eventError);
      // Don't fail if event creation fails - session is already updated
    }

    // Also create parent_feedback event for easier querying
    const { error: feedbackError } = await supabase
      .from('learning_events')
      .insert({
        child_id: data.childId,
        coach_id: data.coachId,
        session_id: data.sessionId,
        event_type: 'parent_feedback',
        event_data: {
          sentiment: data.parentSentiment,
          sees_progress: data.parentSeesProgress,
          feedback: data.concernDetails || aiSummary,
          concerns: data.concernsRaised,
        },
        content_for_embedding: `Parent feedback: ${data.parentSentiment}. ${data.concernDetails || ''} ${aiSummary}`,
        created_at: new Date().toISOString(),
      });

    if (feedbackError) {
      console.error('Feedback event creation error:', feedbackError);
    }

    // Update child's renewal likelihood
    const { error: childUpdateError } = await supabase
      .from('children')
      .update({
        renewal_likelihood: data.renewalLikelihood,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.childId);

    if (childUpdateError) {
      console.error('Child update error:', childUpdateError);
    }

    // If escalated, could trigger a notification here
    if (data.escalateToAdmin) {
      console.log(`ESCALATION: Parent check-in for ${child.name} requires admin attention`);
      // TODO: Send notification to Rucha via email/WhatsApp
    }

    // ==================== AUTO-TRIGGER FINAL ASSESSMENT ====================
    // Check if this was the 9th session and trigger final assessment
    const autoTriggerResult = await checkAndTriggerFinalAssessment(data.childId);
    
    if (autoTriggerResult.triggered) {
      console.log(`🎉 AUTO-TRIGGERED: Final assessment for ${child.name} - ${autoTriggerResult.message}`);
    }

    return NextResponse.json({
      success: true,
      sessionId: data.sessionId,
      summary: aiSummary,
      escalated: data.escalateToAdmin,
      // Include auto-trigger info
      finalAssessment: autoTriggerResult,
    });

  } catch (error) {
    console.error('Parent check-in error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check session status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('scheduled_sessions')
    .select(`
      *,
      child:children(name, parent_name, parent_email)
    `)
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
