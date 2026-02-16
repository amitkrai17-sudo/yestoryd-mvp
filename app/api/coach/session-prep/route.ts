// app/api/coach/session-prep/route.ts
// Uses EXISTING rAI infrastructure - no parallel systems

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { hybridSearch, formatEventsForContext } from '@/lib/rai/hybrid-search';
import { buildSessionPrepPrompt } from '@/lib/rai/prompts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    const sessionDate = searchParams.get('date');
    const sessionTime = searchParams.get('time');
    const sessionType = searchParams.get('type');

    if (!childId) {
      return NextResponse.json({ error: 'childId required' }, { status: 400 });
    }

    // Get child info
    const { data: child } = await supabase
      .from('children')
      .select('child_name, age')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Use EXISTING hybridSearch to get learning events
    const searchResult = await hybridSearch({
      query: `session history progress challenges strengths for ${child.child_name}`,
      childId: childId,
      coachId: auth.coachId,
      userRole: 'coach',
      limit: 20,
      threshold: 0.3,
    });

    // Use EXISTING formatEventsForContext
    const eventsContext = formatEventsForContext(searchResult.events);

    // Use EXISTING buildSessionPrepPrompt
    const sessionInfo = sessionDate ? {
      date: sessionDate,
      time: sessionTime || '',
      type: sessionType || 'coaching'
    } : null;

    const prompt = buildSessionPrepPrompt(child.child_name, eventsContext, sessionInfo);

    // Enhanced prompt for structured insights
    const structuredPrompt = `${prompt}

Additionally, extract and return a JSON object with these fields:
{
  "recap": "Brief summary of recent sessions",
  "current_status": "Where the child is now in their learning journey",
  "session_focus": "What this session should focus on",
  "challenges": ["challenge 1", "challenge 2"],
  "motivators": ["motivator 1", "motivator 2"],
  "watch_for": ["thing to watch 1", "thing to watch 2"],
  "favorite_topics": ["topic 1", "topic 2"],
  "learning_style": "visual/auditory/kinesthetic or description",
  "recommended_activities": ["activity 1", "activity 2"]
}

Return ONLY the JSON object, no other text.`;

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(structuredPrompt);
    const responseText = result.response.text();

    // Parse JSON response
    let insights;
    try {
      // Clean response - remove markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      insights = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      // Return default structure if parsing fails
      insights = {
        recap: 'Unable to generate recap',
        current_status: 'Check previous session notes',
        session_focus: 'Continue from last session',
        challenges: [],
        motivators: [],
        watch_for: [],
        favorite_topics: [],
        learning_style: null,
        recommended_activities: []
      };
    }

    return NextResponse.json({
      success: true,
      childName: child.child_name,
      insights,
      debug: {
        eventsFound: searchResult.events.length,
        filtersApplied: searchResult.debug.filtersApplied
      }
    });

  } catch (error) {
    console.error('Session prep API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
