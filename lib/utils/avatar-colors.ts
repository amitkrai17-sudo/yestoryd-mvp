// ============================================================================
// SHARED AVATAR COLOR UTILITY — Single source of truth
// lib/utils/avatar-colors.ts
// ============================================================================
// Used across coach portal: SessionCard, StudentCard, Discovery Calls, rAI
// Gradient colors for bg-gradient-to-br className usage
// ============================================================================

const AVATAR_GRADIENTS = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600',
  'from-amber-500 to-amber-600',
  'from-indigo-500 to-indigo-600',
  'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600',
] as const;

/** Returns a gradient class string based on name hash. Deterministic — same name always gets same color. */
export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}
