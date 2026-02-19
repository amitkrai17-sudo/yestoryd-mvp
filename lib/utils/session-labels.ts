// =============================================================================
// FILE: lib/utils/session-labels.ts
// PURPOSE: Centralized session type display labels
// =============================================================================

const SESSION_TYPE_LABELS: Record<string, string> = {
  coaching: 'Coaching',
  parent_checkin: 'Check-in (Legacy)',
  parent_call: 'Parent Call',
  skill_booster: 'Skill Booster',
  diagnostic: 'Diagnostic',
  celebration: 'Celebration',
};

/**
 * Returns a human-readable display label for a session type.
 * Single source of truth — use this everywhere instead of inline mappings.
 */
export function getSessionTypeLabel(sessionType: string): string {
  return SESSION_TYPE_LABELS[sessionType] || sessionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
