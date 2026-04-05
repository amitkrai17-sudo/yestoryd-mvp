// ============================================================
// Robust JSON parser for Gemini responses
// Handles: markdown fences, unterminated strings, mixed content
// ============================================================

export function safeParseGeminiJSON<T = any>(raw: string): T | null {
  // Step 1: Strip markdown code fences
  let cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // Step 2: Try direct parse
  try { return JSON.parse(cleaned) as T; } catch {}

  // Step 3: Fix unterminated strings — find last valid closing brace/bracket
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const lastClose = Math.max(lastBrace, lastBracket);
  if (lastClose > 0) {
    const truncated = cleaned.substring(0, lastClose + 1);
    try { return JSON.parse(truncated) as T; } catch {}
  }

  // Step 4: Try extracting JSON object from mixed content
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) as T; } catch {}
  }

  // Step 5: Try extracting JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]) as T; } catch {}
  }

  // Step 6: All attempts failed
  console.error('[safeParseGeminiJSON] All parse attempts failed. Raw:', cleaned.substring(0, 200));
  return null;
}
