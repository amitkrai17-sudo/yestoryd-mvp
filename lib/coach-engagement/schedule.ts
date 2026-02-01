// =============================================================================
// COACH ENGAGEMENT SCHEDULE
// Defines automated touchpoints after approval and onboarding
// =============================================================================

export interface EngagementStep {
  trigger: 'approval' | 'onboarding_complete';
  delayMs: number;
  channel: ('whatsapp' | 'email')[];
  template: string;
  condition?: 'no_assignment' | 'onboarding_incomplete';
}

export const COACH_ENGAGEMENT_SCHEDULE: EngagementStep[] = [
  // Immediate on approval
  {
    trigger: 'approval',
    delayMs: 0,
    channel: ['whatsapp', 'email'],
    template: 'coach_approved_welcome',
  },
  // Day 3 after approval - nudge if onboarding not started
  {
    trigger: 'approval',
    delayMs: 3 * 24 * 60 * 60 * 1000,
    channel: ['whatsapp'],
    template: 'coach_onboarding_reminder',
    condition: 'onboarding_incomplete',
  },
  // Day 7 after approval - check-in
  {
    trigger: 'approval',
    delayMs: 7 * 24 * 60 * 60 * 1000,
    channel: ['whatsapp', 'email'],
    template: 'coach_week_checkin',
    condition: 'onboarding_incomplete',
  },
  // Immediate on onboarding complete
  {
    trigger: 'onboarding_complete',
    delayMs: 0,
    channel: ['whatsapp'],
    template: 'coach_profile_live',
  },
  // Day 3 after onboarding - preparing student
  {
    trigger: 'onboarding_complete',
    delayMs: 3 * 24 * 60 * 60 * 1000,
    channel: ['whatsapp'],
    template: 'coach_preparing_student',
    condition: 'no_assignment',
  },
  // Day 14 after onboarding - status update
  {
    trigger: 'onboarding_complete',
    delayMs: 14 * 24 * 60 * 60 * 1000,
    channel: ['email'],
    template: 'coach_status_update',
    condition: 'no_assignment',
  },
];

/**
 * Build engagement records to insert into coach_engagement_log
 */
export function buildEngagementRecords(
  coachId: string,
  trigger: 'approval' | 'onboarding_complete'
): Array<{
  coach_id: string;
  trigger_event: string;
  scheduled_for: string;
  channel: string;
  template: string;
  condition: string | null;
  status: string;
}> {
  const now = Date.now();

  return COACH_ENGAGEMENT_SCHEDULE
    .filter((step) => step.trigger === trigger)
    .flatMap((step) =>
      step.channel.map((channel) => ({
        coach_id: coachId,
        trigger_event: trigger,
        scheduled_for: new Date(now + step.delayMs).toISOString(),
        channel,
        template: step.template,
        condition: step.condition || null,
        status: 'pending',
      }))
    );
}
