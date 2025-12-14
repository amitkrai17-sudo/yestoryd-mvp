import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Generate embedding
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// Generate AI summary
async function generateAISummary(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('AI summary error:', error);
    return '';
  }
}

/**
 * Save assessment result to learning_events for RAG
 */
export async function saveAssessmentToLearningEvents(
  childId: string,
  assessmentData: {
    score: number;
    wpm?: number;
    fluency?: string;
    pronunciation?: string;
    comprehension?: string;
    areas_to_improve?: string[];
    passage_title?: string;
    feedback?: string;
  },
  createdBy?: string
) {
  const summaryPrompt = `Summarize this reading assessment in 1-2 encouraging sentences for a parent:
Score: ${assessmentData.score}/10
Reading Speed: ${assessmentData.wpm || 'N/A'} WPM
Fluency: ${assessmentData.fluency || 'N/A'}
Pronunciation: ${assessmentData.pronunciation || 'N/A'}
Comprehension: ${assessmentData.comprehension || 'N/A'}
Areas to improve: ${assessmentData.areas_to_improve?.join(', ') || 'None noted'}`;

  const aiSummary = await generateAISummary(summaryPrompt);

  const searchableText = `assessment score ${assessmentData.score} reading wpm ${assessmentData.wpm} fluency ${assessmentData.fluency} pronunciation ${assessmentData.pronunciation} comprehension ${assessmentData.comprehension} ${aiSummary}`;
  
  const embedding = await generateEmbedding(searchableText);

  const { data, error } = await supabase
    .from('learning_events')
    .insert({
      child_id: childId,
      event_type: 'assessment',
      event_date: new Date().toISOString(),
      data: assessmentData,
      ai_summary: aiSummary,
      embedding,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save assessment to learning_events:', error);
    throw error;
  }

  return data;
}

/**
 * Save session notes to learning_events for RAG
 */
export async function saveSessionToLearningEvents(
  childId: string,
  sessionData: {
    session_id: string;
    session_title?: string;
    duration?: number;
    focus_area?: string;
    activities?: string;
    coach_notes?: string;
    session_notes?: string;
    homework?: string;
    progress_observed?: string;
    next_steps?: string;
  },
  createdBy?: string
) {
  const summaryPrompt = `Summarize this coaching session in 1-2 sentences highlighting progress:
Session: ${sessionData.session_title || 'Reading coaching'}
Duration: ${sessionData.duration || 30} minutes
Focus: ${sessionData.focus_area || 'General reading'}
Activities: ${sessionData.activities || 'Reading practice'}
Coach Notes: ${sessionData.coach_notes || sessionData.session_notes || 'No notes'}
Progress: ${sessionData.progress_observed || 'Steady progress'}
Homework: ${sessionData.homework || 'None assigned'}`;

  const aiSummary = await generateAISummary(summaryPrompt);

  const searchableText = `session coaching ${sessionData.session_title} focus ${sessionData.focus_area} activities ${sessionData.activities} notes ${sessionData.coach_notes} ${sessionData.session_notes} homework ${sessionData.homework} progress ${sessionData.progress_observed} ${aiSummary}`;
  
  const embedding = await generateEmbedding(searchableText);

  const { data, error } = await supabase
    .from('learning_events')
    .insert({
      child_id: childId,
      event_type: 'session',
      event_date: new Date().toISOString(),
      data: sessionData,
      ai_summary: aiSummary,
      embedding,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save session to learning_events:', error);
    throw error;
  }

  return data;
}

/**
 * Save quiz result to learning_events for RAG
 */
export async function saveQuizToLearningEvents(
  childId: string,
  quizData: {
    quiz_id?: string;
    topic: string;
    score: number;
    total: number;
    time_taken?: string;
    difficult_questions?: string[];
    passed?: boolean;
  },
  createdBy?: string
) {
  const percentage = Math.round((quizData.score / quizData.total) * 100);
  
  const summaryPrompt = `Summarize this quiz result in 1 encouraging sentence:
Topic: ${quizData.topic}
Score: ${quizData.score}/${quizData.total} (${percentage}%)
Time: ${quizData.time_taken || 'N/A'}
Status: ${quizData.passed !== false ? 'Passed' : 'Needs practice'}`;

  const aiSummary = await generateAISummary(summaryPrompt);

  const searchableText = `quiz ${quizData.topic} score ${quizData.score} out of ${quizData.total} percentage ${percentage} ${quizData.passed ? 'passed' : 'practice needed'} ${aiSummary}`;
  
  const embedding = await generateEmbedding(searchableText);

  const { data, error } = await supabase
    .from('learning_events')
    .insert({
      child_id: childId,
      event_type: 'quiz',
      event_date: new Date().toISOString(),
      data: quizData,
      ai_summary: aiSummary,
      embedding,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save quiz to learning_events:', error);
    throw error;
  }

  return data;
}

/**
 * Save milestone/achievement to learning_events
 */
export async function saveMilestoneToLearningEvents(
  childId: string,
  milestoneData: {
    title: string;
    description?: string;
    badge_type?: string;
  },
  createdBy?: string
) {
  const summaryPrompt = `Create a celebratory 1-sentence summary: ${milestoneData.title}. ${milestoneData.description || ''}`;
  
  const aiSummary = await generateAISummary(summaryPrompt);

  const searchableText = `milestone achievement ${milestoneData.title} ${milestoneData.description} ${milestoneData.badge_type} ${aiSummary}`;
  
  const embedding = await generateEmbedding(searchableText);

  const { data, error } = await supabase
    .from('learning_events')
    .insert({
      child_id: childId,
      event_type: 'milestone',
      event_date: new Date().toISOString(),
      data: milestoneData,
      ai_summary: aiSummary,
      embedding,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save milestone to learning_events:', error);
    throw error;
  }

  return data;
}
