// ============================================================
// E-Learning Prompt Builders
// ============================================================
// 7 prompt functions for session generation + response evaluation.
// Follows assessment-prompts.ts pattern: getAgeConfig() context,
// anti-hallucination rules, JSON-only output.
// All use Flash model (content_generation task type) for speed.
// ============================================================

import { getAgeConfig, getAntiHallucinationRules } from './assessment-prompts';

// ─── Generation Prompts (used by session-builder) ─────────────

/**
 * Prompt to generate warm-up words for phonics practice.
 * Returns JSON array of WarmUpWord objects.
 */
export function buildWarmUpWordsPrompt(
  childName: string,
  childAge: number,
  targetSkill: string,
  weakAreas: string[],
  excludeWords: string[],
  count: number,
): string {
  const ageConfig = getAgeConfig(childAge);
  const weakAreasText = weakAreas.length > 0
    ? `Known weak areas: ${weakAreas.join(', ')}.`
    : 'No specific weak areas recorded.';
  const excludeText = excludeWords.length > 0
    ? `Do NOT use these words (already practiced): ${excludeWords.join(', ')}.`
    : '';

  return `You are a children's reading specialist creating warm-up words for a phonics activity.

CHILD: ${childName}, age ${childAge}
TARGET SKILL: ${targetSkill}
${weakAreasText}
${excludeText}

AGE CONTEXT (${ageConfig.level}):
${ageConfig.guidance}
- Be ${ageConfig.tone} in tone

Generate exactly ${count} words for a warm-up phonics exercise.
Each word must target the skill "${targetSkill}" and be age-appropriate for a ${childAge}-year-old.
Vary difficulty across easy, medium, and hard.

${getAntiHallucinationRules(childName)}

Respond with a JSON array of objects:
[
  {
    "word": "<the word>",
    "phonics_focus": "<specific phonics pattern, e.g. 'short a', 'bl blend'>",
    "hint": "<a short, encouraging hint for the child>",
    "difficulty": "<easy|medium|hard>"
  }
]

Respond ONLY with valid JSON. No markdown, no explanation.`;
}

/**
 * Prompt to generate an age-appropriate reading passage.
 * Returns JSON object with title, passage, word_count.
 */
export function buildStoryPrompt(
  childName: string,
  childAge: number,
  readingLevel: string,
  targetSkills: string[],
  interests: string[],
  wordCountTarget: number,
): string {
  const ageConfig = getAgeConfig(childAge);
  const skillsText = targetSkills.length > 0
    ? `Incorporate vocabulary that practices: ${targetSkills.join(', ')}.`
    : '';
  const interestsText = interests.length > 0
    ? `${childName} enjoys: ${interests.join(', ')}. Try to weave these interests into the story.`
    : '';

  return `You are a children's author creating a short reading passage for a young reader.

CHILD: ${childName}, age ${childAge}
READING LEVEL: ${readingLevel}
TARGET WORD COUNT: ${wordCountTarget} words (aim within ±10%)
${skillsText}
${interestsText}

AGE CONTEXT (${ageConfig.level}):
${ageConfig.guidance}
- Use ${ageConfig.tone} language

RULES:
- The passage must be original and age-appropriate
- Use simple, clear sentences appropriate for reading level "${readingLevel}"
- Include a clear beginning, middle, and end
- Make the story engaging and fun for a ${childAge}-year-old
- Do NOT include any violence, scary content, or inappropriate themes
- Keep to approximately ${wordCountTarget} words

${getAntiHallucinationRules(childName)}

Respond with a JSON object:
{
  "title": "<story title>",
  "passage": "<the full passage text>",
  "word_count": <actual word count as integer>
}

Respond ONLY with valid JSON. No markdown, no explanation.`;
}

/**
 * Prompt to generate comprehension questions about a passage.
 * Returns JSON array of ComprehensionQuestion objects.
 */
export function buildComprehensionQuestionsPrompt(
  childName: string,
  childAge: number,
  passage: string,
  passageTitle: string,
  questionCount: number,
): string {
  const ageConfig = getAgeConfig(childAge);

  return `You are a reading comprehension specialist creating questions for a young reader.

CHILD: ${childName}, age ${childAge}
PASSAGE TITLE: "${passageTitle}"
PASSAGE:
"${passage}"

AGE CONTEXT (${ageConfig.level}):
${ageConfig.guidance}
- Be ${ageConfig.tone} in wording

Generate exactly ${questionCount} comprehension questions about the passage above.
Mix question types:
- "literal": answer directly stated in the text
- "inferential": requires reading between the lines
- "evaluative": asks for opinion or judgment

For children age 7 or younger, include multiple-choice options (3 choices) for at least one question.

${getAntiHallucinationRules(childName)}

Respond with a JSON array:
[
  {
    "question": "<the question>",
    "type": "<literal|inferential|evaluative>",
    "expected_answer_hint": "<a hint about what a good answer includes>",
    "options": ["<option1>", "<option2>", "<option3>"] or null
  }
]

Respond ONLY with valid JSON. No markdown, no explanation.`;
}

/**
 * Prompt to generate a creative writing prompt tied to the passage.
 * Returns JSON object with prompt_text, prompt_type, word_limit_hint.
 */
export function buildCreativePromptPrompt(
  childName: string,
  childAge: number,
  passageTitle: string,
  passageSummary: string,
  skillLevel: string,
): string {
  const ageConfig = getAgeConfig(childAge);

  return `You are a creative writing coach for children.

CHILD: ${childName}, age ${childAge}, skill level: ${skillLevel}
THEY JUST READ: "${passageTitle}"
STORY SUMMARY: ${passageSummary}

AGE CONTEXT (${ageConfig.level}):
${ageConfig.guidance}
- Use a ${ageConfig.tone} tone

Create ONE creative writing prompt that connects to the story they just read.
Choose the most appropriate prompt type for this child's age and level:
- "retell": Retell the story in their own words
- "alternate_ending": Write a different ending
- "character_letter": Write a letter to/from a character
- "opinion": Share their opinion about something in the story
- "continuation": Continue the story

For younger children (≤7), prefer "retell" or "opinion" with lower word limits.
For older children, any type is fine.

${getAntiHallucinationRules(childName)}

Respond with a JSON object:
{
  "prompt_text": "<the creative writing prompt, written directly to the child>",
  "prompt_type": "<retell|alternate_ending|character_letter|opinion|continuation>",
  "word_limit_hint": <suggested word count as integer>
}

Respond ONLY with valid JSON. No markdown, no explanation.`;
}

// ─── Evaluation Prompts (used by interact endpoint) ───────────

/**
 * Prompt to evaluate pronunciation of a target word.
 * Used with audio inlineData in the Gemini call.
 */
export function buildPronunciationAnalysisPrompt(
  childName: string,
  childAge: number,
  targetWord: string,
  phonicsFocus: string,
): string {
  const ageConfig = getAgeConfig(childAge);

  return `You are a phonics specialist evaluating a child's pronunciation.

CHILD: ${childName}, age ${childAge}
TARGET WORD: "${targetWord}"
PHONICS FOCUS: ${phonicsFocus}

AGE CONTEXT (${ageConfig.level}):
- Be ${ageConfig.tone} and encouraging
- ${ageConfig.guidance}

Listen to the attached audio of ${childName} saying the word "${targetWord}".
Evaluate their pronunciation accuracy and provide helpful feedback.

${getAntiHallucinationRules(childName)}

IMPORTANT: If the audio is unclear, silent, or you cannot determine pronunciation,
set is_correct to false and quality to "unclear" — do NOT guess.

Respond with a JSON object:
{
  "is_correct": <true|false>,
  "quality": "<excellent|good|fair|needs_practice|unclear>",
  "feedback": "<1-2 sentences of specific, encouraging feedback for ${childName}>",
  "phonics_tip": "<a short tip about the ${phonicsFocus} pattern>"
}

Respond ONLY with valid JSON. No markdown, no explanation.`;
}

/**
 * Prompt to evaluate a comprehension answer.
 */
export function buildComprehensionEvalPrompt(
  childName: string,
  childAge: number,
  passage: string,
  question: string,
  expectedHint: string,
  childAnswer: string,
): string {
  const ageConfig = getAgeConfig(childAge);

  return `You are a reading comprehension evaluator for children.

CHILD: ${childName}, age ${childAge}
PASSAGE:
"${passage}"

QUESTION: "${question}"
EXPECTED ANSWER HINT: ${expectedHint}
${childName.toUpperCase()}'S ANSWER: "${childAnswer}"

AGE CONTEXT (${ageConfig.level}):
- Be ${ageConfig.tone} and encouraging
- ${ageConfig.guidance}

Evaluate whether ${childName}'s answer demonstrates understanding of the passage.
Be generous with partial credit for young readers.
A child's answer doesn't need to match the hint exactly — credit understanding.

${getAntiHallucinationRules(childName)}

Respond with a JSON object:
{
  "is_correct": <true|false>,
  "quality": "<excellent|good|partial|needs_help>",
  "feedback": "<1-2 sentences of encouraging, specific feedback>",
  "model_answer_hint": "<a simple, age-appropriate model answer>"
}

Respond ONLY with valid JSON. No markdown, no explanation.`;
}

/**
 * Prompt to evaluate a creative writing response.
 */
export function buildCreativeEvalPrompt(
  childName: string,
  childAge: number,
  originalPrompt: string,
  childResponse: string,
  passageContext: string,
): string {
  const ageConfig = getAgeConfig(childAge);

  return `You are a creative writing evaluator for children.

CHILD: ${childName}, age ${childAge}
ORIGINAL PROMPT: "${originalPrompt}"
STORY CONTEXT: ${passageContext}
${childName.toUpperCase()}'S RESPONSE:
"${childResponse}"

AGE CONTEXT (${ageConfig.level}):
- Be ${ageConfig.tone} and very encouraging
- ${ageConfig.guidance}

Evaluate ${childName}'s creative writing response. Focus on:
1. Effort and engagement (most important for young writers)
2. Connection to the original story/prompt
3. Creativity and imagination
4. Vocabulary usage relative to age

Be very encouraging. Every attempt at creative writing should be celebrated.
Score generously — the goal is to build confidence.

${getAntiHallucinationRules(childName)}

Respond with a JSON object:
{
  "creativity_score": <1-10, generous for age>,
  "vocabulary_score": <1-10, relative to age expectations>,
  "feedback": "<2-3 sentences of specific, encouraging feedback highlighting what they did well>",
  "effort_acknowledgment": "<1 sentence celebrating their effort>"
}

Respond ONLY with valid JSON. No markdown, no explanation.`;
}
