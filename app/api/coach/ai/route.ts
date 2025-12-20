// file: app/api/coach/ai/route.ts
// Enhanced rAI API - RAG-powered AI Assistant for coaches
// Pulls from all data sources: children, learning_events, sessions, skills, passages, tips

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RAIRequest {
  message: string;
  coachId: string;
  coachName: string;
  conversationHistory?: Message[];
}

// Common child name patterns
const NAME_PATTERNS = [
  /how is (\w+)/i,
  /tell me about (\w+)/i,
  /(\w+)'s progress/i,
  /(\w+)'s session/i,
  /prepare for (\w+)/i,
  /what should I focus on with (\w+)/i,
  /(\w+)'s homework/i,
  /(\w+)'s assessment/i,
  /update on (\w+)/i,
  /(\w+)'s score/i,
  /(\w+)'s last/i,
  /next session with (\w+)/i,
  /working with (\w+)/i,
];

// Detect if user is asking about a specific child
function detectChildMention(message: string): string | null {
  for (const pattern of NAME_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Filter out common words that aren't names
      const potentialName = match[1];
      const commonWords = ['my', 'the', 'a', 'an', 'this', 'that', 'which', 'what', 'who', 'how'];
      if (!commonWords.includes(potentialName.toLowerCase())) {
        return potentialName;
      }
    }
  }
  return null;
}

// Detect query intent
function detectIntent(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('progress') || lowerMessage.includes('how is') || lowerMessage.includes('doing')) {
    return 'progress';
  }
  if (lowerMessage.includes('prepare') || lowerMessage.includes('next session') || lowerMessage.includes('focus on')) {
    return 'session_prep';
  }
  if (lowerMessage.includes('homework') || lowerMessage.includes('practice')) {
    return 'homework';
  }
  if (lowerMessage.includes('score') || lowerMessage.includes('assessment') || lowerMessage.includes('level')) {
    return 'assessment';
  }
  if (lowerMessage.includes('tip') || lowerMessage.includes('advice') || lowerMessage.includes('help with')) {
    return 'coaching_tips';
  }
  if (lowerMessage.includes('struggling') || lowerMessage.includes('attention') || lowerMessage.includes('needs help')) {
    return 'struggling';
  }
  if (lowerMessage.includes('parent') || lowerMessage.includes('feedback') || lowerMessage.includes('check-in')) {
    return 'parent_feedback';
  }
  if (lowerMessage.includes('all') || lowerMessage.includes('my students') || lowerMessage.includes('overview')) {
    return 'overview';
  }
  if (lowerMessage.includes('passage') || lowerMessage.includes('reading material') || lowerMessage.includes('what to read')) {
    return 'passage_recommendation';
  }
  
  return 'general';
}

// Fetch child data including profile, metrics, and recent events
async function fetchChildContext(childName: string, coachId: string) {
  // Find child by name (case insensitive) assigned to this coach
  const { data: child, error: childError } = await supabase
    .from('children')
    .select(`
      id, name, age, 
      parent_name, parent_email, parent_phone,
      school_name, grade, board,
      languages_at_home, learning_challenges,
      parent_primary_goal, parent_concerns,
      favorite_topics, learning_style, motivators, challenges,
      latest_assessment_score, sessions_completed,
      homework_completion_rate, attendance_rate,
      current_confidence_level, current_reading_level,
      enrolled_at, program_end_date, renewal_likelihood,
      lead_status
    `)
    .eq('coach_id', coachId)
    .ilike('name', `%${childName}%`)
    .single();

  if (childError || !child) {
    return null;
  }

  // Fetch recent learning events (last 10)
  const { data: events } = await supabase
    .from('learning_events')
    .select('event_type, event_subtype, event_data, ai_summary, created_at')
    .eq('child_id', child.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch recent sessions (last 5)
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select(`
      id, session_type, scheduled_date, scheduled_time, status,
      focus_area, progress_rating, engagement_level,
      confidence_level, skills_worked_on,
      tldv_ai_summary, voice_note_transcript,
      homework_assigned, homework_topic,
      breakthrough_moment, concerns_noted,
      flagged_for_attention, flag_reason
    `)
    .eq('child_id', child.id)
    .order('scheduled_date', { ascending: false })
    .limit(5);

  // Fetch skill progress
  const { data: skills } = await supabase
    .from('child_skill_progress')
    .select('skill_code, current_level, last_assessed_at')
    .eq('child_id', child.id)
    .order('last_assessed_at', { ascending: false })
    .limit(10);

  // Fetch homework status
  const { data: homework } = await supabase
    .from('homework_assignments')
    .select('topic, description, status, assigned_at, completed_at')
    .eq('child_id', child.id)
    .order('assigned_at', { ascending: false })
    .limit(3);

  // Fetch reading goals
  const { data: goals } = await supabase
    .from('reading_goals')
    .select('goal_title, target_metric, target_value, current_value, status, target_date')
    .eq('child_id', child.id)
    .eq('status', 'active')
    .limit(3);

  // Fetch parent communications
  const { data: parentComms } = await supabase
    .from('parent_communications')
    .select('communication_type, summary, sentiment, created_at')
    .eq('child_id', child.id)
    .order('created_at', { ascending: false })
    .limit(3);

  return {
    profile: child,
    events: events || [],
    sessions: sessions || [],
    skills: skills || [],
    homework: homework || [],
    goals: goals || [],
    parentCommunications: parentComms || [],
  };
}

// Fetch all students overview for a coach
async function fetchAllStudentsOverview(coachId: string) {
  const { data: children, error } = await supabase
    .from('children')
    .select(`
      id, name, age,
      latest_assessment_score, sessions_completed,
      current_confidence_level, lead_status,
      renewal_likelihood
    `)
    .eq('coach_id', coachId)
    .in('lead_status', ['active', 'enrolled'])
    .order('name');

  if (error || !children) {
    return [];
  }

  // Add recent activity for each child
  const enrichedChildren = await Promise.all(
    children.map(async (child) => {
      const { data: lastSession } = await supabase
        .from('scheduled_sessions')
        .select('scheduled_date, scheduled_time, progress_rating, engagement_level')
        .eq('child_id', child.id)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false })
        .limit(1)
        .single();

      return {
        ...child,
        lastSession,
      };
    })
  );

  return enrichedChildren;
}

// Fetch coaching tips based on topic/scenario
async function fetchCoachingTips(topic: string, scenario?: string) {
  let query = supabase
    .from('coaching_tips')
    .select('title, tip_content, category, applicable_scenarios')
    .eq('is_active', true);

  if (topic) {
    query = query.eq('category', topic);
  }

  const { data: tips } = await query.limit(5);
  return tips || [];
}

// Fetch relevant reading passages
async function fetchRelevantPassages(childAge: number, difficultyLevel: number) {
  const { data: passages } = await supabase
    .from('reading_passages')
    .select('title, content, difficulty_level, genre, theme, skills_targeted')
    .eq('is_active', true)
    .gte('age_min', childAge - 1)
    .lte('age_max', childAge + 1)
    .order('difficulty_level')
    .limit(3);

  return passages || [];
}

// Fetch WCPM benchmarks
async function fetchBenchmarks(gradeLevel: number) {
  const { data: benchmarks } = await supabase
    .from('wcpm_benchmarks')
    .select('*')
    .eq('grade_level', gradeLevel);

  return benchmarks || [];
}

// Build context for Gemini
function buildContext(
  intent: string,
  childContext: any | null,
  allStudents: any[],
  tips: any[],
  passages: any[]
): string {
  let context = '';

  // Child-specific context
  if (childContext) {
    const { profile, events, sessions, skills, homework, goals, parentCommunications } = childContext;

    context += `\n## CHILD PROFILE\n`;
    context += `Name: ${profile.name}\n`;
    context += `Age: ${profile.age} years\n`;
    context += `Current Reading Level: ${profile.current_reading_level || 'Not assessed'}/10\n`;
    context += `Latest Assessment Score: ${profile.latest_assessment_score || 'N/A'}/10\n`;
    context += `Sessions Completed: ${profile.sessions_completed || 0}\n`;
    context += `Confidence Level: ${profile.current_confidence_level || 'N/A'}/5\n`;
    
    if (profile.learning_challenges?.length > 0) {
      context += `Learning Challenges: ${profile.learning_challenges.join(', ')}\n`;
    }
    if (profile.parent_primary_goal) {
      context += `Parent's Goal: ${profile.parent_primary_goal}\n`;
    }
    if (profile.favorite_topics?.length > 0) {
      context += `Interests: ${profile.favorite_topics.join(', ')}\n`;
    }
    if (profile.challenges?.length > 0) {
      context += `Observed Challenges: ${profile.challenges.join(', ')}\n`;
    }
    if (profile.motivators?.length > 0) {
      context += `What Motivates: ${profile.motivators.join(', ')}\n`;
    }
    if (profile.renewal_likelihood) {
      context += `Renewal Likelihood: ${profile.renewal_likelihood}\n`;
    }

    // Recent sessions
    if (sessions.length > 0) {
      context += `\n## RECENT SESSIONS\n`;
      sessions.forEach((s: any, i: number) => {
        const date = new Date(s.scheduled_date).toLocaleDateString();
        context += `\nSession ${i + 1} (${date}):\n`;
        context += `- Focus: ${s.focus_area || 'N/A'}\n`;
        context += `- Progress: ${s.progress_rating || 'N/A'}\n`;
        context += `- Engagement: ${s.engagement_level || 'N/A'}\n`;
        if (s.skills_worked_on?.length > 0) {
          context += `- Skills: ${s.skills_worked_on.join(', ')}\n`;
        }
        if (s.tldv_ai_summary) {
          context += `- Summary: ${s.tldv_ai_summary}\n`;
        }
        if (s.breakthrough_moment) {
          context += `- Breakthrough: ${s.breakthrough_moment}\n`;
        }
        if (s.concerns_noted) {
          context += `- Concerns: ${s.concerns_noted}\n`;
        }
      });
    }

    // Recent events (assessments, notes, etc.)
    if (events.length > 0) {
      context += `\n## LEARNING EVENTS\n`;
      events.forEach((e: any) => {
        const date = new Date(e.created_at).toLocaleDateString();
        context += `- ${date}: [${e.event_type}] `;
        if (e.ai_summary) {
          context += e.ai_summary;
        } else if (e.event_data?.overall_score) {
          context += `Score: ${e.event_data.overall_score}/10`;
        }
        context += '\n';
      });
    }

    // Skills progress
    if (skills.length > 0) {
      context += `\n## SKILL PROGRESS\n`;
      skills.forEach((s: any) => {
        const levelLabels = ['', 'Not started', 'Learning', 'Practicing', 'Proficient', 'Mastered'];
        context += `- ${s.skill_code}: ${levelLabels[s.current_level] || 'Unknown'}\n`;
      });
    }

    // Homework
    if (homework.length > 0) {
      context += `\n## HOMEWORK\n`;
      homework.forEach((h: any) => {
        context += `- ${h.topic}: ${h.status}\n`;
      });
    }

    // Goals
    if (goals.length > 0) {
      context += `\n## ACTIVE GOALS\n`;
      goals.forEach((g: any) => {
        context += `- ${g.goal_title}: ${g.current_value || 0}/${g.target_value} (Due: ${g.target_date || 'No date'})\n`;
      });
    }

    // Parent communications
    if (parentCommunications.length > 0) {
      context += `\n## RECENT PARENT FEEDBACK\n`;
      parentCommunications.forEach((p: any) => {
        const date = new Date(p.created_at).toLocaleDateString();
        context += `- ${date}: [${p.sentiment}] ${p.summary}\n`;
      });
    }
  }

  // All students overview
  if (allStudents.length > 0 && (intent === 'overview' || intent === 'struggling')) {
    context += `\n## YOUR STUDENTS (${allStudents.length} total)\n`;
    
    // Sort by score for struggling identification
    const sortedStudents = [...allStudents].sort((a, b) => 
      (a.latest_assessment_score || 0) - (b.latest_assessment_score || 0)
    );

    sortedStudents.forEach((s: any) => {
      context += `- ${s.name} (Age ${s.age}): Score ${s.latest_assessment_score || 'N/A'}/10, `;
      context += `${s.sessions_completed || 0} sessions, `;
      context += `Confidence ${s.current_confidence_level || 'N/A'}/5`;
      if (s.lastSession?.progress_rating) {
        context += `, Last session: ${s.lastSession.progress_rating}`;
      }
      context += '\n';
    });
  }

  // Coaching tips
  if (tips.length > 0) {
    context += `\n## RELEVANT COACHING TIPS\n`;
    tips.forEach((t: any) => {
      context += `\n### ${t.title}\n${t.tip_content}\n`;
    });
  }

  // Recommended passages
  if (passages.length > 0) {
    context += `\n## RECOMMENDED PASSAGES\n`;
    passages.forEach((p: any) => {
      context += `- "${p.title}" (Level ${p.difficulty_level}, ${p.theme})\n`;
    });
  }

  return context;
}

// Call Gemini API
async function callGemini(
  userMessage: string,
  context: string,
  coachName: string,
  conversationHistory: Message[]
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return "I'm having trouble connecting to my knowledge base right now. Please try again in a moment.";
  }

  const systemPrompt = `You are rAI, an AI coaching assistant for Yestoryd - a children's reading coaching platform in India. You help reading coaches by providing personalized insights about their students.

You are speaking with Coach ${coachName}.

${context}

GUIDELINES:
1. Be warm, supportive, and encouraging
2. Use the child's name when discussing them
3. Provide specific, actionable advice based on the data
4. Reference actual session data, scores, and observations when available
5. If you don't have specific data, acknowledge this and provide general guidance
6. Keep responses concise but helpful (2-3 paragraphs max unless asked for details)
7. Highlight progress and wins, but be honest about areas needing work
8. Suggest specific next steps when relevant
9. Use Indian context-appropriate examples when needed
10. If asked about a child not in the data, politely say you don't have access to that child's information

IMPORTANT: Only answer based on the context provided. Don't make up data.`;

  // Build conversation
  const messages = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: "I understand. I'm rAI, ready to help with coaching insights based on student data." }] },
  ];

  // Add conversation history
  conversationHistory.forEach((msg) => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  });

  // Add current message
  messages.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text());
      throw new Error('Gemini API error');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 
           "I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error('Gemini call error:', error);
    return "I'm having trouble processing your request. Please try again.";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RAIRequest = await request.json();
    const { message, coachId, coachName, conversationHistory = [] } = body;

    if (!message || !coachId) {
      return NextResponse.json(
        { error: 'Message and coachId are required' },
        { status: 400 }
      );
    }

    // Detect intent and child mention
    const intent = detectIntent(message);
    const childName = detectChildMention(message);

    let childContext = null;
    let allStudents: any[] = [];
    let tips: any[] = [];
    let passages: any[] = [];

    // Fetch relevant data based on intent
    if (childName) {
      childContext = await fetchChildContext(childName, coachId);
      
      if (childContext) {
        // Fetch coaching tips based on child's challenges
        if (childContext.profile.challenges?.length > 0) {
          tips = await fetchCoachingTips('behavior', childContext.profile.challenges[0]);
        }
        
        // Fetch relevant passages if session prep
        if (intent === 'session_prep' || intent === 'passage_recommendation') {
          passages = await fetchRelevantPassages(
            childContext.profile.age,
            childContext.profile.current_reading_level || 5
          );
        }
      }
    }

    // Fetch all students for overview or struggling queries
    if (intent === 'overview' || intent === 'struggling' || !childName) {
      allStudents = await fetchAllStudentsOverview(coachId);
    }

    // Fetch general coaching tips if needed
    if (intent === 'coaching_tips') {
      const topic = message.toLowerCase().includes('phonics') ? 'phonics' :
                    message.toLowerCase().includes('fluency') ? 'fluency' :
                    message.toLowerCase().includes('engagement') ? 'engagement' :
                    message.toLowerCase().includes('parent') ? 'parent_communication' :
                    'engagement';
      tips = await fetchCoachingTips(topic);
    }

    // Build context
    const context = buildContext(intent, childContext, allStudents, tips, passages);

    // Call Gemini
    const response = await callGemini(message, context, coachName, conversationHistory);

    return NextResponse.json({
      response,
      detectedChild: childContext?.profile?.name || null,
      intent,
      hasData: !!(childContext || allStudents.length > 0),
    });

  } catch (error) {
    console.error('rAI API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    status: 'rAI API active',
    model: GEMINI_MODEL,
    hasApiKey: !!GEMINI_API_KEY,
  });
}