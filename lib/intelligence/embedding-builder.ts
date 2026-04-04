/**
 * SINGLE source of truth for building session intelligence content_for_embedding.
 * Every session-related learning_event (Recall transcript, structured capture,
 * legacy coach form) uses this function.
 *
 * Design: structured sections in consistent order so RAG retrieval is FAIR
 * across modalities. In-person captures get the same structure as online
 * transcript events — no pipeline produces systematically thinner embeddings.
 *
 * Non-session events (assessments, elearning, practice, operational) keep
 * their own domain-specific builders — they don't compete in RAG with session events.
 */
export function buildUnifiedEmbeddingContent(params: {
  // Required context
  childName: string;
  eventDate: string | Date;
  eventType: string;
  sessionModality: string | null;

  // Skills & performance
  skillsCovered?: string[];
  skillPerformances?: Array<{
    skillName: string;
    accuracy?: string;
    itemsAttempted?: number;
    itemsCorrect?: number;
    observations?: string[];
    note?: string;
  }>;

  // Observations
  strengthObservations?: string[];
  struggleObservations?: string[];
  customStrengthNote?: string;
  customStruggleNote?: string;

  // Engagement
  engagementLevel?: string;
  contextTags?: string[];

  // Source-specific rich content (bonus — truncated to keep embedding focused)
  aiSummary?: string;
  highlights?: string[];
  challenges?: string[];
  breakthroughMoment?: string;
  coachNotes?: string;
  homeworkAssigned?: string[];
  nextSessionFocus?: string;

  // Child artifact
  artifactText?: string;
  artifactAnalysis?: string;

  // Words (phonics-specific)
  wordsMastered?: string[];
  wordsStruggled?: string[];

  // Assessment specific
  assessmentType?: string;
  overallScore?: number;
  fluencyRating?: string;

  // Focus area (from coach form / session plan)
  focusArea?: string;
  skillsWorkedOn?: string[];

  // Transcript-specific
  coachTalkRatio?: number;
  childReadingSamples?: string[];
  keyObservations?: string[];
  concernsNoted?: string;
}): string {
  const date = params.eventDate instanceof Date
    ? params.eventDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date(params.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const modality = params.sessionModality || 'unknown';

  const sections: string[] = [];

  // 1. Context line (ALWAYS)
  sections.push(`${params.childName} ${modality} ${params.eventType} on ${date}`);

  // 2. Skills covered
  if (params.skillsCovered?.length) {
    sections.push(`Skills covered: ${params.skillsCovered.join(', ')}`);
  }
  if (params.skillsWorkedOn?.length) {
    sections.push(`Skills worked on: ${params.skillsWorkedOn.join(', ')}`);
  }
  if (params.focusArea) {
    sections.push(`Focus area: ${params.focusArea}`);
  }

  // 3. Per-skill performance
  if (params.skillPerformances?.length) {
    const perfDetails = params.skillPerformances.map(sp => {
      const parts = [sp.skillName];
      if (sp.accuracy) parts.push(`accuracy: ${sp.accuracy}`);
      if (sp.itemsAttempted) parts.push(`${sp.itemsCorrect ?? 0}/${sp.itemsAttempted} correct`);
      if (sp.observations?.length) parts.push(`observations: ${sp.observations.join(', ')}`);
      if (sp.note) parts.push(`note: ${sp.note}`);
      return parts.join(', ');
    });
    sections.push(`Performance: ${perfDetails.join('. ')}`);
  }

  // 4. Observations
  if (params.strengthObservations?.length) {
    sections.push(`Strengths: ${params.strengthObservations.join(', ')}`);
  }
  if (params.struggleObservations?.length) {
    sections.push(`Struggles: ${params.struggleObservations.join(', ')}`);
  }
  if (params.customStrengthNote) {
    sections.push(`Coach noted strength: ${params.customStrengthNote}`);
  }
  if (params.customStruggleNote) {
    sections.push(`Coach noted struggle: ${params.customStruggleNote}`);
  }
  if (params.keyObservations?.length) {
    sections.push(`Observations: ${params.keyObservations.join(', ')}`);
  }
  if (params.concernsNoted) {
    sections.push(`Concerns: ${params.concernsNoted}`);
  }

  // 5. Words
  if (params.wordsMastered?.length) {
    sections.push(`Words mastered: ${params.wordsMastered.join(', ')}`);
  }
  if (params.wordsStruggled?.length) {
    sections.push(`Words struggled: ${params.wordsStruggled.join(', ')}`);
  }

  // 6. Engagement
  if (params.engagementLevel) {
    sections.push(`Engagement: ${params.engagementLevel}`);
  }
  if (params.contextTags?.length) {
    sections.push(`Context: ${params.contextTags.join(', ')}`);
  }

  // 7. Source-specific enrichment
  if (params.aiSummary) {
    sections.push(`AI summary: ${params.aiSummary.slice(0, 500)}`);
  }
  if (params.highlights?.length) {
    sections.push(`Highlights: ${params.highlights.join(', ')}`);
  }
  if (params.challenges?.length) {
    sections.push(`Challenges: ${params.challenges.join(', ')}`);
  }
  if (params.breakthroughMoment) {
    sections.push(`Breakthrough: ${params.breakthroughMoment}`);
  }
  if (params.coachNotes) {
    sections.push(`Coach notes: ${params.coachNotes.slice(0, 300)}`);
  }
  if (params.coachTalkRatio) {
    sections.push(`Coach talk ratio: ${params.coachTalkRatio}%`);
  }
  if (params.childReadingSamples?.length) {
    sections.push(`Reading samples: ${params.childReadingSamples.join(', ')}`);
  }
  if (params.homeworkAssigned?.length) {
    sections.push(`Homework: ${params.homeworkAssigned.join(', ')}`);
  }
  if (params.nextSessionFocus) {
    sections.push(`Next focus: ${params.nextSessionFocus}`);
  }

  // 8. Child artifact
  if (params.artifactText) {
    sections.push(`Child response: ${params.artifactText.slice(0, 300)}`);
  }
  if (params.artifactAnalysis) {
    sections.push(`Artifact analysis: ${params.artifactAnalysis.slice(0, 300)}`);
  }

  // 9. Assessment specific
  if (params.assessmentType) {
    sections.push(`Assessment type: ${params.assessmentType}`);
  }
  if (params.overallScore !== undefined) {
    sections.push(`Overall score: ${params.overallScore}`);
  }
  if (params.fluencyRating) {
    sections.push(`Fluency: ${params.fluencyRating}`);
  }

  return sections.filter(Boolean).join('. ');
}
