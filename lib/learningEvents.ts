import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import { insertLearningEvent } from '@/lib/rai/learning-events';

// Generate AI summary
async function generateAISummary(prompt: string): Promise<string> {
  try {
    const model = getGenAI().getGenerativeModel({ model: getGeminiModel('story_summarization') });
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
): Promise<{ id: string } | null> {
  const summaryPrompt = `Summarize this reading assessment in 1-2 encouraging sentences for a parent:
Score: ${assessmentData.score}/10
Reading Speed: ${assessmentData.wpm || 'N/A'} WPM
Fluency: ${assessmentData.fluency || 'N/A'}
Pronunciation: ${assessmentData.pronunciation || 'N/A'}
Comprehension: ${assessmentData.comprehension || 'N/A'}
Areas to improve: ${assessmentData.areas_to_improve?.join(', ') || 'None noted'}`;

  const aiSummary = await generateAISummary(summaryPrompt);

  const searchableText = `assessment score ${assessmentData.score} reading wpm ${assessmentData.wpm} fluency ${assessmentData.fluency} pronunciation ${assessmentData.pronunciation} comprehension ${assessmentData.comprehension} ${aiSummary}`;

  return insertLearningEvent({
    childId,
    eventType: 'assessment',
    eventData: assessmentData as Record<string, unknown>,
    legacyData: assessmentData as Record<string, unknown>,
    contentForEmbedding: searchableText,
    aiSummary,
    signalSource: 'diagnostic_assessment',
    signalConfidence: 'high',
    createdBy,
  });
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
): Promise<{ id: string } | null> {
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

  return insertLearningEvent({
    childId,
    eventType: 'session',
    eventData: sessionData as Record<string, unknown>,
    legacyData: sessionData as Record<string, unknown>,
    contentForEmbedding: searchableText,
    aiSummary,
    signalSource: 'coach_form',
    signalConfidence: 'medium',
    createdBy,
  });
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
): Promise<{ id: string } | null> {
  const percentage = Math.round((quizData.score / quizData.total) * 100);

  const summaryPrompt = `Summarize this quiz result in 1 encouraging sentence:
Topic: ${quizData.topic}
Score: ${quizData.score}/${quizData.total} (${percentage}%)
Time: ${quizData.time_taken || 'N/A'}
Status: ${quizData.passed !== false ? 'Passed' : 'Needs practice'}`;

  const aiSummary = await generateAISummary(summaryPrompt);

  const searchableText = `quiz ${quizData.topic} score ${quizData.score} out of ${quizData.total} percentage ${percentage} ${quizData.passed ? 'passed' : 'practice needed'} ${aiSummary}`;

  return insertLearningEvent({
    childId,
    eventType: 'quiz',
    eventData: quizData as Record<string, unknown>,
    legacyData: quizData as Record<string, unknown>,
    contentForEmbedding: searchableText,
    aiSummary,
    signalSource: 'elearning_system',
    signalConfidence: 'medium',
    createdBy,
  });
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
): Promise<{ id: string } | null> {
  const summaryPrompt = `Create a celebratory 1-sentence summary: ${milestoneData.title}. ${milestoneData.description || ''}`;

  const aiSummary = await generateAISummary(summaryPrompt);

  const searchableText = `milestone achievement ${milestoneData.title} ${milestoneData.description} ${milestoneData.badge_type} ${aiSummary}`;

  return insertLearningEvent({
    childId,
    eventType: 'milestone',
    eventData: milestoneData as Record<string, unknown>,
    legacyData: milestoneData as Record<string, unknown>,
    contentForEmbedding: searchableText,
    aiSummary,
    signalSource: 'system_generated',
    signalConfidence: 'medium',
    createdBy,
  });
}

/**
 * Save progress pulse to learning_events for RAG + parent display
 */
export async function saveProgressPulseToLearningEvents(
  childId: string,
  pulseData: {
    pulse_number: number;
    completed_sessions: number;
    overall_progress: string;
    confidence_trend: string;
    headline: string;
    parent_summary: string;
    strengths: string[];
    focus_areas: string[];
    home_activities: string[];
    coach_notes: string;
    milestone_reached?: string;
    enrollment_id: string;
  },
  coachId?: string
): Promise<{ id: string }> {
  const summaryPrompt = `Summarize this progress report in 1-2 sentences:
Progress: ${pulseData.overall_progress}
Headline: ${pulseData.headline}
Strengths: ${pulseData.strengths.join(', ')}
Focus areas: ${pulseData.focus_areas.join(', ')}
${pulseData.milestone_reached ? `Milestone: ${pulseData.milestone_reached}` : ''}`;

  const aiSummary = await generateAISummary(summaryPrompt);

  const searchableText = `progress pulse report ${pulseData.headline} progress ${pulseData.overall_progress} confidence ${pulseData.confidence_trend} strengths ${pulseData.strengths.join(' ')} focus ${pulseData.focus_areas.join(' ')} ${pulseData.milestone_reached || ''} ${aiSummary}`;

  const result = await insertLearningEvent({
    childId,
    coachId,
    eventType: 'progress_pulse',
    eventData: pulseData as Record<string, unknown>,
    legacyData: pulseData as Record<string, unknown>,
    contentForEmbedding: searchableText,
    aiSummary,
    signalSource: 'system_generated',
    signalConfidence: 'medium',
  });

  if (!result) {
    throw new Error(`Failed to save progress pulse to learning_events for child ${childId}`);
  }

  return result;
}
