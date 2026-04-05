// ============================================================
// FILE: lib/homework/generate-smart-practice.ts
// PURPOSE: Generate interactive homework (passage + MCQ quiz)
// from coach's original homework notes using Gemini.
// Stores passage in el_content_items, questions in video_quizzes.
// Links back to parent_daily_tasks via content_item_id.
// ============================================================

import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import {
  buildStoryPrompt,
  buildComprehensionQuestionsPrompt,
} from '@/lib/gemini/elearning-prompts';

interface SmartPracticeParams {
  coachNotes: string;
  childName: string;
  childAge: number;
  skillSlug: string;
  childId: string;
  taskId: string;
  supabase: any; // ReturnType<typeof createAdminClient>
}

interface SmartPracticeResult {
  success: boolean;
  contentItemId?: string;
  questionCount?: number;
  passageTitle?: string;
  error?: string;
}

// --- Helpers ---

function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

function getTargetWordCount(age: number): number {
  if (age <= 5) return 50;
  if (age <= 6) return 70;
  if (age <= 7) return 90;
  if (age <= 8) return 110;
  if (age <= 9) return 130;
  if (age <= 10) return 150;
  return 180;
}

async function callGemini(prompt: string): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: getGeminiModel('content_generation') });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// --- Main Generator ---

/**
 * Generate an interactive homework quiz from coach notes.
 * Creates: el_content_item (passage) + video_quizzes (MCQ questions).
 * Links the content_item to the parent_daily_task.
 * Non-blocking — caller should fire-and-forget.
 */
export async function generateSmartPractice(
  params: SmartPracticeParams
): Promise<SmartPracticeResult> {
  const { coachNotes, childName, childAge, skillSlug, childId, taskId, supabase } = params;

  try {
    // STEP 1: Generate reading passage from coach notes
    // Coach notes become the topic/skill context for the passage
    const storyPrompt = buildStoryPrompt(
      childName,
      childAge,
      skillSlug,                    // readingLevel — use skill as context
      [skillSlug, coachNotes.substring(0, 200)], // targetSkills — include coach intent
      [],                           // interests — none available here
      getTargetWordCount(childAge),
    );

    const storyText = await callGemini(storyPrompt);
    const story = parseJsonResponse<{ title: string; passage: string; word_count: number }>(storyText);

    if (!story.passage || story.passage.length < 30) {
      return { success: false, error: 'Generated passage too short' };
    }

    // STEP 2: Generate 4 MCQ comprehension questions about the passage
    const questionCount = childAge <= 6 ? 3 : 4;
    const questionsPrompt = buildComprehensionQuestionsPrompt(
      childName,
      childAge,
      story.passage,
      story.title || 'Reading Practice',
      questionCount,
    );

    const questionsText = await callGemini(questionsPrompt);
    const rawQuestions = parseJsonResponse<Array<{
      question: string;
      type: string;
      expected_answer_hint: string;
      options: string[] | null;
    }>>(questionsText);

    // Ensure ALL questions have MCQ options (generate if missing)
    const mcqQuestions = rawQuestions
      .filter(q => q.question && q.question.length > 5)
      .map(q => {
        // If no options provided, create them from the hint
        const opts = Array.isArray(q.options) && q.options.length >= 3
          ? q.options
          : [q.expected_answer_hint, 'None of the above', 'I am not sure'];
        return { ...q, options: opts };
      })
      .slice(0, questionCount);

    if (mcqQuestions.length < 2) {
      return { success: false, error: 'Not enough valid questions generated' };
    }

    // STEP 3: Create el_content_item to store the passage + metadata
    const { data: contentItem, error: contentErr } = await supabase
      .from('el_content_items')
      .insert({
        title: `SmartPractice: ${story.title || 'Reading Practice'}`,
        content_type: 'homework_quiz',
        description: story.passage.substring(0, 200) + '...',
        metadata: {
          passage_text: story.passage,
          passage_title: story.title,
          passage_word_count: story.word_count || story.passage.split(/\s+/).length,
          coach_notes: coachNotes,
          child_id: childId,
          task_id: taskId,
          skill_slug: skillSlug,
          question_count: mcqQuestions.length,
          generated_at: new Date().toISOString(),
        },
        is_active: true,
      })
      .select('id')
      .single();

    if (contentErr || !contentItem) {
      return { success: false, error: `Content item creation failed: ${contentErr?.message}` };
    }

    // STEP 4: Insert questions into video_quizzes
    // Use contentItem.id as video_id — this is the grouping key that
    // QuizPlayer and submit-quiz use to fetch/grade questions.
    const quizInserts = mcqQuestions.map((q, idx) => {
      // First option is always the correct answer (from comprehension prompt output)
      // Shuffle options for the child, but track the correct one
      const correctText = q.options[0]; // Gemini puts correct answer as expected_answer_hint-based
      const shuffled = [...q.options].sort(() => Math.random() - 0.5);
      const correctIdx = shuffled.indexOf(correctText);

      return {
        video_id: contentItem.id, // grouping key for quiz lookup
        question_text: q.question,
        question_type: 'multiple_choice',
        options: shuffled, // string[] stored as JSONB
        correct_option_id: String(correctIdx), // index as string (matches QuizPlayer pattern)
        explanation: q.expected_answer_hint || null,
        points: 10,
        display_order: idx + 1,
      };
    });

    const { error: quizErr } = await supabase
      .from('video_quizzes')
      .insert(quizInserts);

    if (quizErr) {
      // Clean up content item if quiz insert failed
      await supabase.from('el_content_items').delete().eq('id', contentItem.id);
      return { success: false, error: `Quiz insert failed: ${quizErr.message}` };
    }

    // STEP 5: Link content item to the task
    await supabase
      .from('parent_daily_tasks')
      .update({ content_item_id: contentItem.id })
      .eq('id', taskId);

    console.log(`[SmartPractice] Generated: ${mcqQuestions.length} questions for task ${taskId}, content ${contentItem.id}`);

    return {
      success: true,
      contentItemId: contentItem.id,
      questionCount: mcqQuestions.length,
      passageTitle: story.title,
    };
  } catch (error: any) {
    console.error(`[SmartPractice] Generation failed for task ${taskId}:`, error.message);
    return { success: false, error: error.message };
  }
}
