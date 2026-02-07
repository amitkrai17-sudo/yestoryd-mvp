// =============================================================================
// FILE: app/api/coach/ai-suggestion/route.ts
// PURPOSE: Generate AI-powered next session recommendations using Gemini
// USES: Child's learning history + current session data
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Focus area labels for display
const FOCUS_LABELS: Record<string, string> = {
  phonics_letter_sounds: 'Phonics & Letter Sounds',
  reading_fluency: 'Reading Fluency',
  reading_comprehension: 'Reading Comprehension',
  vocabulary_building: 'Vocabulary Building',
  grammar_syntax: 'Grammar & Syntax',
  creative_writing: 'Creative Writing',
  pronunciation: 'Pronunciation',
  story_analysis: 'Story Analysis',
};

/**
 * Generate AI-powered next session recommendation
 * Uses child's history + current session data
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const payload = await request.json();
    const {
      childId,
      childName,
      childAge,
      sessionNumber,
      primaryFocus,
      skillsPracticed,
      highlights,
      challenges,
      focusProgress,
      engagementLevel,
    } = payload;

    console.log('=== AI SUGGESTION REQUEST ===');
    console.log('Child:', childName, 'Age:', childAge);
    console.log('Focus:', primaryFocus, 'Progress:', focusProgress);

    // Validate required fields
    if (!childName || !primaryFocus || !focusProgress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1. Fetch child's previous sessions from learning_events
    let historyContext = 'No previous sessions recorded.';

    if (childId) {
      const { data: previousSessions } = await supabaseAdmin
        .from('learning_events')
        .select('event_data, event_date')
        .eq('child_id', childId)
        .eq('event_type', 'session')
        .order('event_date', { ascending: false })
        .limit(5);

      // 2. Build context from history
      if (previousSessions && previousSessions.length > 0) {
        historyContext = previousSessions
          .map((s, i) => {
            const data = s.event_data as Record<string, unknown>;
            const focusKey = (data.focus_area as string) || 'Unknown';
            const focusLabel = FOCUS_LABELS[focusKey] || focusKey.replace(/_/g, ' ');
            const progressStr = ((data.progress_rating as string) || 'Unknown').replace(/_/g, ' ');
            const highlightsArr = (data.highlights as string[]) || [];
            const challengesArr = (data.challenges as string[]) || [];

            return `Session ${i + 1} (${new Date(s.event_date || Date.now()).toLocaleDateString()}):
  - Focus: ${focusLabel}
  - Progress: ${progressStr}
  - Highlights: ${highlightsArr.join(', ') || 'None recorded'}
  - Challenges: ${challengesArr.join(', ') || 'None recorded'}`;
          })
          .join('\n\n');
      }
    }

    // 3. Build prompt for Gemini
    const focusLabel = FOCUS_LABELS[primaryFocus] || primaryFocus.replace(/_/g, ' ');
    const progressLabel = focusProgress.replace(/_/g, ' ');

    const prompt = `You are rAI, Yestoryd's reading intelligence assistant helping coaches plan effective sessions for children.

CHILD PROFILE:
- Name: ${childName}
- Age: ${childAge} years
- This is session #${sessionNumber || 1}

PREVIOUS SESSIONS (most recent first):
${historyContext}

TODAY'S SESSION:
- Focus Area: ${focusLabel}
- Skills Practiced: ${skillsPracticed?.join(', ') || 'Not specified'}
- What Clicked: ${highlights?.join(', ') || 'Nothing specific noted'}
- Challenges: ${challenges?.length > 0 ? challenges.join(', ') : 'None noted'}
- Progress Level: ${progressLabel}
- Engagement: ${engagementLevel || 'Not specified'}

TASK: Provide a specific, actionable recommendation for the NEXT session (2-3 sentences max).

GUIDELINES:
1. Build on today's wins - reinforce what clicked
2. Address recurring challenges if any pattern exists
3. Suggest age-appropriate progression
4. Be encouraging but specific
5. Mention exact skills or activities when possible
6. If engagement was low, suggest ways to increase it

Respond with ONLY the recommendation, no preamble or explanation.`;

    // 4. Call Gemini
    let suggestion: string;
    let isFallback = false;

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContent(prompt);
      suggestion = result.response.text().trim();

      // Validate response
      if (!suggestion || suggestion.length < 20) {
        throw new Error('Invalid AI response');
      }
    } catch (aiError) {
      console.warn('Gemini API error, using fallback:', aiError);
      const fallback = generateFallbackSuggestion(
        primaryFocus,
        focusProgress,
        highlights?.[0],
        childName
      );
      suggestion = fallback.suggestion;
      isFallback = true;
    }

    const duration = Date.now() - startTime;
    console.log(`=== AI SUGGESTION ${isFallback ? 'FALLBACK' : 'SUCCESS'} (${duration}ms) ===`);
    console.log('Suggestion:', suggestion.substring(0, 100) + '...');

    // 5. Extract recommended activities from suggestion
    const recommendedActivities = extractActivities(suggestion, primaryFocus, focusProgress);

    return NextResponse.json({
      success: true,
      suggestion,
      recommendedActivities,
      context: {
        previousSessionsAnalyzed: childId ? 5 : 0,
        processingTimeMs: duration,
        fallback: isFallback,
      },
    });
  } catch (error) {
    console.error('AI suggestion error:', error);

    // Return fallback suggestion on any error
    const fallback = generateFallbackSuggestion(
      'reading_fluency',
      'improved',
      undefined,
      'the student'
    );

    return NextResponse.json({
      success: true,
      suggestion: fallback.suggestion,
      recommendedActivities: fallback.activities,
      context: {
        fallback: true,
        reason: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Extract activity suggestions based on focus and progress
 */
function extractActivities(
  suggestion: string,
  focus: string,
  progress: string
): string[] {
  // Progress-based activity suggestions
  const progressActivities: Record<string, Record<string, string[]>> = {
    breakthrough: {
      phonics_letter_sounds: ['Increase Difficulty', 'New Phonics Pattern', 'Independent Practice'],
      reading_fluency: ['Timed Reading Challenge', 'Expression Focus', 'Longer Passages'],
      reading_comprehension: ['Complex Questions', 'Inference Practice', 'Critical Thinking'],
      vocabulary_building: ['Advanced Words', 'Context Application', 'Word Games'],
      grammar_syntax: ['Complex Sentences', 'Writing Application', 'Error Correction'],
      creative_writing: ['Longer Stories', 'Genre Exploration', 'Peer Sharing'],
      pronunciation: ['Connected Speech', 'Recording Practice', 'Self-Evaluation'],
      story_analysis: ['Theme Analysis', 'Author Study', 'Comparative Reading'],
    },
    significant_improvement: {
      phonics_letter_sounds: ['Continue Current Level', 'Add Variety', 'Speed Drills'],
      reading_fluency: ['Reinforce with Variety', 'Phrasing Practice', 'Prosody Work'],
      reading_comprehension: ['More Practice', 'Different Text Types', 'Discussion'],
      vocabulary_building: ['Word Families', 'Synonym Games', 'Usage Practice'],
      grammar_syntax: ['More Examples', 'Interactive Games', 'Application'],
      creative_writing: ['Story Building', 'Descriptive Practice', 'Editing Skills'],
      pronunciation: ['Sound Reinforcement', 'Tongue Twisters', 'Reading Aloud'],
      story_analysis: ['Character Focus', 'Plot Mapping', 'Retelling'],
    },
    improved: {
      phonics_letter_sounds: ['Continue Practice', 'Review Weak Areas', 'Consolidate'],
      reading_fluency: ['Repeated Reading', 'Sight Words', 'Confidence Building'],
      reading_comprehension: ['Guided Questions', 'Picture Support', 'Summarizing'],
      vocabulary_building: ['Review Words', 'Simple Contexts', 'Flashcards'],
      grammar_syntax: ['Basic Rules', 'Sentence Practice', 'Examples'],
      creative_writing: ['Story Starters', 'Sentence Expansion', 'Prompts'],
      pronunciation: ['Sound Practice', 'Slow Reading', 'Modeling'],
      story_analysis: ['Basic Questions', 'Character ID', 'Setting'],
    },
    same: {
      phonics_letter_sounds: ['Review Basics', 'Different Approach', 'Games'],
      reading_fluency: ['Simplify Texts', 'Echo Reading', 'Support'],
      reading_comprehension: ['Visual Aids', 'Smaller Chunks', 'Discussion'],
      vocabulary_building: ['Fewer Words', 'More Practice', 'Context'],
      grammar_syntax: ['Simple Sentences', 'One Rule Focus', 'Practice'],
      creative_writing: ['Free Writing', 'Drawing + Writing', 'Prompts'],
      pronunciation: ['Individual Sounds', 'Mirror Practice', 'Patience'],
      story_analysis: ['Simple Stories', 'Questions', 'Pictures'],
    },
    declined: {
      phonics_letter_sounds: ['Review Fundamentals', 'Build Confidence', 'Encouragement'],
      reading_fluency: ['Easier Texts', 'Support', 'Patience'],
      reading_comprehension: ['Simple Questions', 'Read Together', 'Discussion'],
      vocabulary_building: ['Basic Words', 'Repetition', 'Games'],
      grammar_syntax: ['Very Simple', 'Examples', 'No Pressure'],
      creative_writing: ['Free Expression', 'No Correction', 'Fun'],
      pronunciation: ['Basic Sounds', 'Encouragement', 'Games'],
      story_analysis: ['Picture Books', 'Simple Talk', 'Fun'],
    },
  };

  // Default activities if no match
  const defaultActivities = ['Continue Practice', 'Review Basics', 'Skill Reinforcement'];

  // Get activities for this focus and progress
  const focusActivities = progressActivities[progress]?.[focus];
  if (focusActivities) {
    return focusActivities;
  }

  // Fallback to default activities for the focus
  const defaultByFocus: Record<string, string[]> = {
    phonics_letter_sounds: ['Continue Phonics', 'Sound Practice', 'Blending'],
    reading_fluency: ['Reading Practice', 'Expression', 'Pacing'],
    reading_comprehension: ['Questions', 'Summarizing', 'Discussion'],
    vocabulary_building: ['Word Learning', 'Context', 'Games'],
    grammar_syntax: ['Grammar Practice', 'Sentences', 'Rules'],
    creative_writing: ['Writing Practice', 'Stories', 'Expression'],
    pronunciation: ['Sound Practice', 'Speaking', 'Listening'],
    story_analysis: ['Story Discussion', 'Analysis', 'Themes'],
  };

  return defaultByFocus[focus] || defaultActivities;
}

/**
 * Fallback when Gemini is unavailable
 */
function generateFallbackSuggestion(
  focus: string,
  progress: string,
  highlight?: string,
  childName?: string
): { suggestion: string; activities: string[] } {
  const focusLabel = FOCUS_LABELS[focus] || focus?.replace(/_/g, ' ') || 'reading skills';
  const name = childName || 'the student';

  const progressSuggestions: Record<string, string> = {
    breakthrough: `Excellent progress! Build on this momentum by introducing slightly more challenging ${focusLabel} exercises. ${name} is ready to advance to the next level.`,
    significant_improvement: `Great session! Continue reinforcing ${focusLabel} while gradually increasing complexity. Consider adding variety to maintain ${name}'s engagement.`,
    improved: `Good progress in ${focusLabel}. Continue the current approach with more practice opportunities. Consistency will help ${name} build confidence.`,
    same: `Consider trying a different approach to ${focusLabel}. Breaking down concepts into smaller steps may help. Keep sessions engaging and encouraging for ${name}.`,
    declined: `Review foundational ${focusLabel} concepts with ${name}. Focus on building confidence with easier exercises before progressing. Ensure plenty of encouragement and support.`,
  };

  const defaultSuggestion = `Continue working on ${focusLabel} with ${name}. Focus on reinforcing today's learning with varied practice activities.`;

  return {
    suggestion: progressSuggestions[progress] || defaultSuggestion,
    activities: extractActivities('', focus, progress),
  };
}
