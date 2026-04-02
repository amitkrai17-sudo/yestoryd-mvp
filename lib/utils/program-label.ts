// =============================================================================
// PROGRAM LABEL UTILITIES
// lib/utils/program-label.ts
//
// Centralises all enrollment-type-aware text for parent-facing communications.
// Coaching enrollments use "English Coaching Program".
// Tuition enrollments use skill_categories.parent_label + " Sessions".
//
// Usage:
//   import { getProgramContext } from '@/lib/utils/program-label';
//   const ctx = getProgramContext(enrollment, categoryParentLabel);
//   subject = ctx.emailSubject(childName);
// =============================================================================

// ---------------------------------------------------------------------------
// Types — intentionally minimal so callers can pass partial enrollment data
// ---------------------------------------------------------------------------

export interface EnrollmentForLabel {
  billing_model?: string | null;
  program_description?: string | null;
  sessions_remaining?: number | null;
  total_sessions?: number | null;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/** Is this a tuition (prepaid_sessions) enrollment? */
export function isTuitionEnrollment(enrollment: EnrollmentForLabel): boolean {
  return enrollment.billing_model === 'prepaid_sessions' || enrollment.billing_model === 'session_pack';
}

/**
 * Human-readable program name.
 *
 * Resolution order:
 *  1. enrollment.program_description (pre-populated in DB)
 *  2. For tuition: "{categoryParentLabel} Sessions" if a category was linked
 *  3. Fallback tuition: "Tuition Sessions"
 *  4. Coaching: "English Coaching Program"
 *
 * @param enrollment  - must include billing_model + program_description
 * @param categoryParentLabel - optional, from skill_categories.parent_label
 */
export function getProgramLabel(
  enrollment: EnrollmentForLabel,
  categoryParentLabel?: string | null,
): string {
  if (enrollment.program_description) return enrollment.program_description;

  if (isTuitionEnrollment(enrollment)) {
    return categoryParentLabel
      ? `${categoryParentLabel} Sessions`
      : 'Tuition Sessions';
  }

  return 'English Coaching Program';
}

/**
 * Email subject line for enrollment-related emails.
 *
 * Tuition:  "Welcome to Yestoryd — {child}'s {label} Confirmed"
 * Coaching: "Welcome to Yestoryd — {child}'s Learning Journey Begins"
 */
export function getEnrollmentEmailSubject(
  childName: string,
  enrollment: EnrollmentForLabel,
  categoryParentLabel?: string | null,
): string {
  if (isTuitionEnrollment(enrollment)) {
    const label = getProgramLabel(enrollment, categoryParentLabel);
    return `Welcome to Yestoryd — ${childName}'s ${label} Confirmed`;
  }
  return `Welcome to Yestoryd — ${childName}'s Learning Journey Begins`;
}

/**
 * Short schedule blurb for emails / WhatsApp.
 *
 * Tuition:  "X sessions purchased — schedule with your coach as needed"
 * Coaching: "Your complete session schedule is shared below"
 */
export function getScheduleDescription(enrollment: EnrollmentForLabel): string {
  if (isTuitionEnrollment(enrollment)) {
    const count = enrollment.sessions_remaining ?? enrollment.total_sessions;
    const prefix = count ? `${count} sessions purchased` : 'Sessions purchased';
    return `${prefix} — schedule with your coach as needed`;
  }
  return 'Your complete session schedule is shared below';
}

// ---------------------------------------------------------------------------
// Composite context object — consume this in email templates
// ---------------------------------------------------------------------------

export interface ProgramContext {
  /** e.g. "Grammar Sessions" or "English Coaching Program" */
  label: string;
  isTuition: boolean;
  /** Whether to render the full session-schedule table */
  showSchedule: boolean;
  /** Whether to render Season badges / season-number */
  showSeason: boolean;
  /** e.g. "8 sessions purchased — schedule with your coach as needed" */
  scheduleDescription: string;
  /** e.g. "Welcome to Yestoryd — Aarav's Grammar Sessions Confirmed" */
  emailSubject: (childName: string) => string;
}

/**
 * Build a ProgramContext from an enrollment row + optional category label.
 *
 * Example:
 *   const ctx = getProgramContext(enrollment, 'Grammar');
 *   // ctx.label → "Grammar Sessions"
 *   // ctx.showSchedule → false  (tuition = no upfront schedule)
 */
export function getProgramContext(
  enrollment: EnrollmentForLabel,
  categoryParentLabel?: string | null,
): ProgramContext {
  const tuition = isTuitionEnrollment(enrollment);
  const label = getProgramLabel(enrollment, categoryParentLabel);

  return {
    label,
    isTuition: tuition,
    showSchedule: !tuition,
    showSeason: !tuition,
    scheduleDescription: getScheduleDescription(enrollment),
    emailSubject: (childName: string) =>
      getEnrollmentEmailSubject(childName, enrollment, categoryParentLabel),
  };
}
