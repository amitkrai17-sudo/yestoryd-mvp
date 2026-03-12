// ============================================================
// FILE: lib/gemini/artifact-prompts.ts
// PURPOSE: Prompt builders for child artifact analysis
// ============================================================
// Quality gate (readability check) + main analysis prompt.
// Pattern follows lib/gemini/assessment-prompts.ts.
// ============================================================

// ==================== TYPES ====================

export interface ArtifactQualityResult {
  readability_score: number;
  issues: string[];
}

export interface ArtifactObservation {
  skill: string;
  observation: string;
  quality: 'strength' | 'developing' | 'needs_work';
}

export interface ArtifactAnalysisResult {
  content_type: string;
  skills_demonstrated: string[];
  specific_observations: ArtifactObservation[];
  error_patterns: string[];
  age_appropriate: 'at' | 'above' | 'below' | 'unable_to_assess';
  child_feedback: string;
  parent_summary: string;
}

// ==================== QUALITY GATE PROMPT ====================

/**
 * Build the readability quality gate prompt for image artifacts.
 * Returns a prompt that asks Gemini to score readability 0.0-1.0.
 */
export function buildQualityGatePrompt(): string {
  return `Assess the readability of this child's work. Score from 0.0 to 1.0:
1.0 = perfectly clear, well-lit, focused
0.7 = readable with effort, slightly blurry or at angle
0.4 = partially readable, some sections unclear
0.0 = completely unreadable, too blurry/dark/cropped

Return JSON only, no extra text:
{ "readability_score": <number>, "issues": ["<issue1>", ...] }

Issues should describe specific problems (e.g., "image too dark", "text cut off at edges", "heavy glare on paper", "extreme angle distortion").
If the image is clear, return an empty issues array.`;
}

// ==================== MAIN ANALYSIS PROMPT ====================

/**
 * Build the main artifact analysis prompt.
 * Includes anti-hallucination rules and age-appropriate context.
 */
export function buildImageAnalysisPrompt(params: {
  childName: string;
  childAge: number | null;
  ageBand: string | null;
  assignmentDescription: string | null;
  lowConfidence?: boolean;
}): string {
  const { childName, childAge, ageBand, assignmentDescription, lowConfidence } = params;

  const ageContext = childAge
    ? `Child: ${childName}, age ${childAge}${ageBand ? `, age band: ${ageBand}` : ''}.`
    : `Child: ${childName}.`;

  const assignment = assignmentDescription || 'General practice work';

  const confidenceWarning = lowConfidence
    ? `\nIMPORTANT: This image has lower readability. Be conservative in your analysis — only assess what you can clearly see. Mark uncertain dimensions as "unable_to_assess".`
    : '';

  return `Analyze this child's work.
${ageContext}
Assignment: ${assignment}.
${confidenceWarning}

Provide the following analysis:

1. content_type: One of (handwriting_practice, creative_writing, drawing, worksheet, spelling, reading_response, other)

2. skills_demonstrated: Array of skills visible in this work (e.g., "letter formation", "sentence structure", "creative expression", "phonics application", "spelling accuracy", "fine motor control", "story structure", "vocabulary use")

3. specific_observations: Array of objects, each with:
   - skill: the skill being observed
   - observation: specific, evidence-based observation (what you see in the work)
   - quality: "strength" | "developing" | "needs_work"

4. error_patterns: Array of recurring errors you notice (e.g., "b/d reversal", "inconsistent letter sizing", "missing punctuation"). Empty array if none.

5. age_appropriate: "at" | "above" | "below" | "unable_to_assess" — compared to typical expectations for this age

6. child_feedback: Encouraging, specific feedback for the child (2-3 sentences, warm tone, age-appropriate language for a ${childAge || 7}-year-old). Start with something positive they did well, then one gentle suggestion.

7. parent_summary: Brief factual summary for the parent (1-2 sentences). Focus on what skills were demonstrated and any notable patterns.

ANTI-HALLUCINATION RULES (MANDATORY):
- Base analysis ONLY on observable evidence in the image
- Do NOT infer skills that are not directly demonstrated
- If unable to assess a dimension, mark as "unable_to_assess" or omit from skills_demonstrated
- Do NOT assume the child's writing says something you cannot clearly read
- If handwriting is partially illegible, only analyze the readable portions
- Do NOT fabricate error patterns that are not clearly visible
- Be specific: reference what you actually see, not what you expect to see

Return as JSON only, no extra text:
{
  "content_type": "<string>",
  "skills_demonstrated": ["<skill1>", ...],
  "specific_observations": [{ "skill": "<string>", "observation": "<string>", "quality": "<string>" }, ...],
  "error_patterns": ["<pattern1>", ...],
  "age_appropriate": "<string>",
  "child_feedback": "<string>",
  "parent_summary": "<string>"
}`;
}

// ==================== TEXT ANALYSIS PROMPT ====================

/**
 * Build analysis prompt for typed text submissions (no image).
 */
export function buildTextAnalysisPrompt(params: {
  childName: string;
  childAge: number | null;
  ageBand: string | null;
  assignmentDescription: string | null;
  typedText: string;
}): string {
  const { childName, childAge, ageBand, assignmentDescription, typedText } = params;

  const ageContext = childAge
    ? `Child: ${childName}, age ${childAge}${ageBand ? `, age band: ${ageBand}` : ''}.`
    : `Child: ${childName}.`;

  const assignment = assignmentDescription || 'General practice work';

  return `Analyze this child's written text submission.
${ageContext}
Assignment: ${assignment}.

Child's text:
"""
${typedText}
"""

Provide the following analysis:

1. content_type: One of (creative_writing, spelling, reading_response, sentence_practice, other)

2. skills_demonstrated: Array of skills visible (e.g., "sentence structure", "vocabulary use", "spelling accuracy", "creative expression", "punctuation", "grammar")

3. specific_observations: Array of objects, each with:
   - skill: the skill being observed
   - observation: specific, evidence-based observation
   - quality: "strength" | "developing" | "needs_work"

4. error_patterns: Array of recurring errors (e.g., "run-on sentences", "missing capitals at start"). Empty array if none.

5. age_appropriate: "at" | "above" | "below" | "unable_to_assess"

6. child_feedback: Encouraging, specific feedback for the child (2-3 sentences, warm tone, age-appropriate for a ${childAge || 7}-year-old).

7. parent_summary: Brief factual summary for the parent (1-2 sentences).

ANTI-HALLUCINATION RULES:
- Analyze ONLY the text provided above
- Do NOT infer skills not demonstrated in the text
- Be specific about what the child wrote well and where they can improve

Return as JSON only:
{
  "content_type": "<string>",
  "skills_demonstrated": ["<skill1>", ...],
  "specific_observations": [{ "skill": "<string>", "observation": "<string>", "quality": "<string>" }, ...],
  "error_patterns": ["<pattern1>", ...],
  "age_appropriate": "<string>",
  "child_feedback": "<string>",
  "parent_summary": "<string>"
}`;
}

// ==================== EMBEDDING CONTENT BUILDER ====================

/**
 * Build rich natural language content for RAG embedding.
 */
export function buildArtifactEmbeddingContent(params: {
  childName: string;
  artifactType: string;
  contentType: string;
  skills: string[];
  observations: ArtifactObservation[];
  parentSummary: string;
  assignmentDescription?: string | null;
}): string {
  const parts: string[] = [
    `${params.childName} artifact: ${params.artifactType}`,
    `Content type: ${params.contentType}`,
  ];

  if (params.assignmentDescription) {
    parts.push(`Assignment: ${params.assignmentDescription}`);
  }

  if (params.skills.length > 0) {
    parts.push(`Skills demonstrated: ${params.skills.join(', ')}`);
  }

  const strengths = params.observations.filter(o => o.quality === 'strength');
  const developing = params.observations.filter(o => o.quality === 'developing');
  const needsWork = params.observations.filter(o => o.quality === 'needs_work');

  if (strengths.length > 0) {
    parts.push(`Strengths: ${strengths.map(o => o.observation).join('; ')}`);
  }
  if (developing.length > 0) {
    parts.push(`Developing: ${developing.map(o => o.observation).join('; ')}`);
  }
  if (needsWork.length > 0) {
    parts.push(`Needs work: ${needsWork.map(o => o.observation).join('; ')}`);
  }

  parts.push(params.parentSummary);

  return parts.join('. ').trim();
}
