// ============================================================================
// UNIFIED DATE/TIME FORMATTING — Single source of truth
// lib/utils/date-format.ts
// ============================================================================
// All date formatting in the codebase should use these functions.
// Locale: en-IN, Timezone: Asia/Kolkata
// ============================================================================

const LOCALE = 'en-IN' as const;
const TIMEZONE = 'Asia/Kolkata' as const;

/** "7 Mar 2026" — primary format for UI display */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

/** "Monday, 7 March 2026" — for formal contexts like agreements */
export function formatDateLong(date: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

/** "Mon, 7 Mar" — compact format for cards/lists */
export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

/** "2:30 PM" — 12-hour time for India market */
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

/** "7 Mar 2026, 2:30 PM" — combined date + time */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

/** "6:00 AM" — convert 24h time string "06:00" to 12h display */
export function formatTime12(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/** "Today" / "Tomorrow" / "Mon, 7 Mar" — relative-aware short format */
export function formatDateRelative(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = new Date(dateStr + 'T00:00:00');
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';

  return date.toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
