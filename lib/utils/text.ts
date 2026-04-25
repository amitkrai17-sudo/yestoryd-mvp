/**
 * Text utility helpers.
 */

/**
 * Extracts the last sentence from a paragraph of text.
 * Used to surface trajectory summary from narrative_profile.summary
 * (and similar multi-sentence summary fields).
 *
 * Falls back to the full trimmed text if no sentence boundary is found.
 *
 * @example
 *   extractLastSentence("Ira is doing great. Progress has been good across all areas.")
 *   // => "Progress has been good across all areas."
 */
export function extractLastSentence(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  const sentences = trimmed.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length === 0) return trimmed;

  return sentences[sentences.length - 1].trim();
}
