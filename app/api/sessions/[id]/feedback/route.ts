// ============================================================
// SESSION FEEDBACK & PREP API
// File: app/api/sessions/[id]/feedback/route.ts
// GET - Get session details with prep data
// POST - Submit structured feedback
// PATCH - Update prep notes
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Schema for feedback submission
const FeedbackSchema = z.object({
  // Existing fields
  focus_area: z.string().max(100).optional(),
  progress_rating: z.enum(['improved', 'same', 'struggled']).optional(),
  engagement_level: z.enum(['high', 'medium', 'low']).optional(),
  confidence_level: z.number().int().min(1).max(5).optional(),
  skills_worked_on: z.array(z.string()).max(10).optional(),
  
  // New structured feedback
  skills_improved: z.array(z.string()).max(10).optional(),
  skills_need_work: z.array(z.string()).max(10).optional(),
  next_session_focus: z.array(z.string()).max(5).optional(),
  
  // Text fields
  breakthrough_moment: z.string().max(500).optional(),
  concerns_noted: z.string().max(500).optional(),
  coach_notes: z.string().max(2000).optional(),
  
  // Homework
  homework_assigned: z.boolean().default(false),
  homework_topic: z.string().max(100).optional(),
  homework_description: z.string().max(500).optional(),
  
  // Flags
  flagged_for_attention: z.boolean().default(false),
  flag_reason: z.string().max(200).optional(),
  parent_communication_needed: z.boolean().default(false),
  
  // Overall rating
  rating_overall: z.number().int().min(1).max(5).optional(),
});

// Schema for prep update
const PrepSchema = z.object({
  prep_notes: z.string().max(2000).optional(),
  prep_content_ids: z.array(z.string().uuid()).max(10).optional(),
});

// =====================================================
// GET - Get session details with prep data
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionId = params.id;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Get session with related data
    const { data: session, error } = await supabase
      .from('scheduled_sessions')
      .select(`
        *,
        children (
          id,
          child_name,
          age,
          learning_needs,
          primary_focus_area,
          latest_assessment_score,
          assessment_wpm,
          parent_name,
          parent_email
        ),
        coaches (
          id,
          name,
          email
        )
      `)
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check authorization (coach can only see their own sessions)
    if (auth.role === 'coach' && session.coach_id !== auth.coachId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get child's learning history (last 5 sessions)
    const { data: recentSessions } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        session_number,
        scheduled_date,
        status,
        focus_area,
        progress_rating,
        skills_worked_on,
        skills_improved,
        skills_need_work,
        breakthrough_moment,
        concerns_noted,
        rating_overall
      `)
      .eq('child_id', session.child_id)
      .eq('status', 'completed')
      .neq('id', sessionId)
      .order('scheduled_date', { ascending: false })
      .limit(5);

    // Get learning events for this child
    const { data: learningEvents } = await supabase
      .from('learning_events')
      .select('event_type, event_data, created_at')
      .eq('child_id', session.child_id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Analyze patterns
    const patterns = analyzePatterns(recentSessions || [], learningEvents || []);

    // Get recommended content based on child's needs
    let recommendedContent: any[] = [];
    const childNeeds = session.children?.learning_needs || [];
    if (childNeeds.length > 0) {
      // This would connect to e-learning content when available
      // For now, return empty
    }

    return NextResponse.json({
      success: true,
      session,
      learning_history: {
        recent_sessions: recentSessions || [],
        learning_events: learningEvents || [],
        patterns,
      },
      recommended_content: recommendedContent,
      feedback_submitted: !!session.feedback_submitted_at,
    });

  } catch (error) {
    console.error('Session feedback GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// POST - Submit structured feedback
// =====================================================
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionId = params.id;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Get session to verify ownership
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('id, coach_id, child_id, status')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check authorization
    if (auth.role === 'coach' && session.coach_id !== auth.coachId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Validate feedback data
    const body = await request.json();
    const validation = FeedbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const feedback = validation.data;

    // Build update payload
    const updatePayload: Record<string, any> = {
      ...feedback,
      feedback_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update session with feedback
    const { data: updated, error } = await supabase
      .from('scheduled_sessions')
      .update(updatePayload)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating session:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create learning event for RAG
    await supabase
      .from('learning_events')
      .insert({
        child_id: session.child_id,
        event_type: 'session_feedback',
        event_data: {
          session_id: sessionId,
          feedback,
          coach_id: session.coach_id,
        },
      });

    // Update child's learning needs based on feedback
    if (feedback.skills_need_work && feedback.skills_need_work.length > 0) {
      const { data: child } = await supabase
        .from('children')
        .select('learning_needs')
        .eq('id', session.child_id)
        .single();

      const currentNeeds = child?.learning_needs || [];
      const updatedNeeds = [...new Set([...currentNeeds, ...feedback.skills_need_work])];

      await supabase
        .from('children')
        .update({ 
          learning_needs: updatedNeeds,
          primary_focus_area: feedback.next_session_focus?.[0] || child?.learning_needs?.[0],
        })
        .eq('id', session.child_id);
    }

    // If parent communication needed, create notification
    if (feedback.parent_communication_needed) {
      // This would trigger a notification - integrate with existing communication system
      console.log('Parent communication needed for session:', sessionId);
    }

    return NextResponse.json({
      success: true,
      session: updated,
      message: 'Feedback submitted successfully',
    });

  } catch (error) {
    console.error('Session feedback POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// PATCH - Update prep notes
// =====================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionId = params.id;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Get session to verify ownership
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('id, coach_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check authorization
    if (auth.role === 'coach' && session.coach_id !== auth.coachId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Validate prep data
    const body = await request.json();
    const validation = PrepSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    // Update session with prep data
    const { data: updated, error } = await supabase
      .from('scheduled_sessions')
      .update({
        prep_notes: validation.data.prep_notes,
        prep_content_ids: validation.data.prep_content_ids,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating prep:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: updated,
      message: 'Prep notes saved',
    });

  } catch (error) {
    console.error('Session prep PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// Helper function to analyze learning patterns
// =====================================================
function analyzePatterns(
  recentSessions: any[],
  learningEvents: any[]
): {
  common_struggles: string[];
  improved_skills: string[];
  engagement_trend: 'improving' | 'stable' | 'declining';
  suggested_focus: string[];
} {
  const struggles: Record<string, number> = {};
  const improvements: Record<string, number> = {};
  const engagementScores: string[] = [];

  for (const session of recentSessions) {
    // Track struggles
    if (session.skills_need_work) {
      for (const skill of session.skills_need_work) {
        struggles[skill] = (struggles[skill] || 0) + 1;
      }
    }

    // Track improvements
    if (session.skills_improved) {
      for (const skill of session.skills_improved) {
        improvements[skill] = (improvements[skill] || 0) + 1;
      }
    }

    // Track engagement
    if (session.engagement_level) {
      engagementScores.push(session.engagement_level);
    }
  }

  // Calculate engagement trend
  let engagementTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (engagementScores.length >= 3) {
    const scoreMap = { high: 3, medium: 2, low: 1 };
    const recent = engagementScores.slice(0, 3).map(s => scoreMap[s as keyof typeof scoreMap] || 2);
    const older = engagementScores.slice(3, 6).map(s => scoreMap[s as keyof typeof scoreMap] || 2);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
    
    if (recentAvg > olderAvg + 0.3) engagementTrend = 'improving';
    else if (recentAvg < olderAvg - 0.3) engagementTrend = 'declining';
  }

  // Sort by frequency
  const commonStruggles = Object.entries(struggles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skill]) => skill);

  const improvedSkills = Object.entries(improvements)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skill]) => skill);

  // Suggested focus = struggles that haven't improved
  const suggestedFocus = commonStruggles.filter(s => !improvedSkills.includes(s));

  return {
    common_struggles: commonStruggles,
    improved_skills: improvedSkills,
    engagement_trend: engagementTrend,
    suggested_focus: suggestedFocus,
  };
}
