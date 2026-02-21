// =============================================================================
// FILE: app/api/coach/ai-suggestion/route.ts
// PURPOSE: Generate AI-powered next session recommendations using Gemini
// USES: Child's learning history + current session data
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { searchContentUnits, formatContentUnitsForContext } from '@/lib/rai/hybrid-search';

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

    // 1. Fetch child's learning profile + previous sessions
    let historyContext = 'No previous sessions recorded.';
    let profileContext = '';
    let profile: Record<string, any> | null = null;

    if (childId) {
      // Fetch synthesized learning profile (primary context, column may not exist)
      try {
        const { data: childRow } = await supabaseAdmin
          .from('children')
          .select('learning_profile')
          .eq('id', childId)
          .single();
        profile = childRow?.learning_profile as Record<string, any> | null;
      } catch {
        // Column doesn't exist yet — skip profile context
      }
      if (profile && Object.keys(profile).length > 0) {
        profileContext = `
SYNTHESIZED LEARNING PROFILE (updated after each session):
- Reading Level: ${profile.reading_level?.current || 'Unknown'}, Trend: ${profile.reading_level?.trend || 'unknown'}
- Active Skills: ${(profile.active_skills || []).join(', ') || 'None identified'}
- Mastered Skills: ${(profile.mastered_skills || []).join(', ') || 'None yet'}
- Struggle Areas: ${(profile.struggle_areas || []).map((s: any) => `${s.skill} (${s.severity}, ${s.sessions_struggling} sessions)`).join(', ') || 'None'}
- What Works: ${(profile.what_works || []).join('; ') || 'Not enough data'}
- What Doesn't Work: ${(profile.what_doesnt_work || []).join('; ') || 'Not enough data'}
- Personality: ${profile.personality_notes || 'Not enough data'}
- Parent Engagement: ${profile.parent_engagement?.level || 'unknown'}
- Sessions Completed: ${profile.sessions_completed || 0}, Remaining: ${profile.sessions_remaining || '?'}
- Recommended Next Focus: ${profile.recommended_focus_next_session || 'Not set'}`;
      }

      // Fetch raw session history (secondary context)
      const { data: previousSessions } = await supabaseAdmin
        .from('learning_events')
        .select('event_data, event_date')
        .eq('child_id', childId)
        .eq('event_type', 'session')
        .order('event_date', { ascending: false })
        .limit(5);

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

    // 2b. Search content library for relevant units + individual content items
    let contentContext = '';
    let recommendedContent: { id: string; title: string; content_type: string; skills: string[]; yrl_level: string | null; similarity?: number }[] = [];
    try {
      // Build search query from session context
      const searchParts: string[] = [];
      if (primaryFocus) searchParts.push(FOCUS_LABELS[primaryFocus] || primaryFocus.replace(/_/g, ' '));
      if (challenges?.length) searchParts.push(challenges.join(', '));
      if (highlights?.length) searchParts.push(highlights.join(', '));
      if (skillsPracticed?.length) searchParts.push(skillsPracticed.join(', '));

      // Also use struggle areas from profile if available
      const struggleAreas = (profile as any)?.struggle_areas as Array<{ skill: string }> | undefined;
      if (struggleAreas?.length) {
        searchParts.push(struggleAreas.map((s: { skill: string }) => s.skill).join(', '));
      }

      if (searchParts.length > 0) {
        const searchQuery = searchParts.join(' ');

        // Parallel: search learning units AND content items
        const [contentUnits, contentItemsResult] = await Promise.all([
          searchContentUnits({
            query: searchQuery,
            childAge: childAge || null,
            limit: 3,
            threshold: 0.25,
          }),
          // Search el_content_items via text match (no RPC needed)
          (async () => {
            try {
              const keywords = searchQuery.split(/\s+/).filter(w => w.length > 2).slice(0, 3);
              if (keywords.length === 0) return [];

              // Text search on search_text
              let query = (supabaseAdmin as any)
                .from('el_content_items')
                .select('id, title, content_type, yrl_level, search_text')
                .eq('is_active', true)
                .limit(5);

              // Use ilike with first keyword for broadest match
              query = query.ilike('search_text', `%${keywords[0]}%`);

              const { data } = await query;
              if (!data || data.length === 0) return [];

              // Fetch skill tags for these items
              const ids = data.map((d: any) => d.id);
              const { data: tags } = await (supabaseAdmin as any)
                .from('el_content_tags')
                .select('content_item_id, el_skills(name)')
                .in('content_item_id', ids);

              const skillsByContent: Record<string, string[]> = {};
              for (const tag of tags || []) {
                if (!skillsByContent[tag.content_item_id]) skillsByContent[tag.content_item_id] = [];
                if (tag.el_skills?.name) skillsByContent[tag.content_item_id].push(tag.el_skills.name);
              }

              return data.map((item: any) => ({
                id: item.id,
                title: item.title,
                content_type: item.content_type,
                skills: skillsByContent[item.id] || [],
                yrl_level: item.yrl_level,
              }));
            } catch {
              return [];
            }
          })(),
        ]);

        if (contentUnits.length > 0) {
          contentContext = '\n\n' + formatContentUnitsForContext(contentUnits);
          console.log(`Content units found: ${contentUnits.length}`);
        }

        if (contentItemsResult.length > 0) {
          recommendedContent = contentItemsResult;
          console.log(`Content items found: ${contentItemsResult.length}`);
        }
      }
    } catch (err) {
      console.warn('Content search failed (non-blocking):', err);
    }

    // 3. Build prompt for Gemini
    const focusLabel = FOCUS_LABELS[primaryFocus] || primaryFocus.replace(/_/g, ' ');
    const progressLabel = focusProgress.replace(/_/g, ' ');

    const prompt = `You are rAI, Yestoryd's reading intelligence assistant helping coaches plan effective sessions for children.

CHILD PROFILE:
- Name: ${childName}
- Age: ${childAge} years
- This is session #${sessionNumber || 1}
${profileContext}

PREVIOUS SESSIONS (most recent first):
${historyContext}

TODAY'S SESSION:
- Focus Area: ${focusLabel}
- Skills Practiced: ${skillsPracticed?.join(', ') || 'Not specified'}
- What Clicked: ${highlights?.join(', ') || 'Nothing specific noted'}
- Challenges: ${challenges?.length > 0 ? challenges.join(', ') : 'None noted'}
- Progress Level: ${progressLabel}
- Engagement: ${engagementLevel || 'Not specified'}
${contentContext}

TASK: Provide a specific, actionable recommendation for the NEXT session (2-3 sentences max).

GUIDELINES:
1. Build on today's wins - reinforce what clicked
2. Address recurring challenges if any pattern exists
3. Suggest age-appropriate progression
4. Be encouraging but specific
5. If content units are listed above, reference them by name and content code when relevant
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
      recommended_content: recommendedContent.length > 0 ? recommendedContent : undefined,
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
