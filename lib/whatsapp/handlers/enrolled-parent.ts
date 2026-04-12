// ============================================================
// FILE: lib/whatsapp/handlers/enrolled-parent.ts
// PURPOSE: Handle inbound Lead Bot (8591) messages that arrive from an
//          already-enrolled parent. Redirects to dashboard / coach /
//          support rather than running the lead-qualification funnel.
// ============================================================

import type { EnrolledChild } from '@/lib/whatsapp/enrolled-parent-lookup';

const DASHBOARD_URL = 'https://yestoryd.com/parent';
const SUPPORT_EMAIL = 'engage@yestoryd.com';

function firstWord(full: string | null | undefined, fallback: string): string {
  if (!full) return fallback;
  return full.split(/\s+/)[0] || fallback;
}

export async function handleEnrolledParent(
  _phone: string,
  message: string,
  childData: EnrolledChild
): Promise<string> {
  const childName = firstWord(childData.child_name || childData.name, 'your child');
  const coachName = firstWord(childData.coachName, 'your coach');
  const lowerMsg = (message || '').toLowerCase();

  if (lowerMsg.includes('session') || lowerMsg.includes('class') || lowerMsg.includes('schedule')) {
    return `For ${childName}'s session details, please check the dashboard:\n${DASHBOARD_URL}\n\nFor scheduling changes, please contact ${coachName} directly.\n\nYestoryd`;
  }

  if (lowerMsg.includes('practice') || lowerMsg.includes('homework') || lowerMsg.includes('task')) {
    return `${childName}'s practice tasks are on the dashboard:\n${DASHBOARD_URL}\n\nYestoryd`;
  }

  if (lowerMsg.includes('pay') || lowerMsg.includes('fee') || lowerMsg.includes('renew')) {
    return `For payment and renewal queries, please check the dashboard or contact us at ${SUPPORT_EMAIL}\n\n${DASHBOARD_URL}\n\nYestoryd`;
  }

  if (lowerMsg.includes('cancel') || lowerMsg.includes('stop') || lowerMsg.includes('pause')) {
    return `For enrollment changes, please contact us at ${SUPPORT_EMAIL} or call Rucha directly.\n\nYestoryd`;
  }

  return `Hi! ${childName} is enrolled with Yestoryd.\n\nFor session details, practice tasks, and progress — check the dashboard:\n${DASHBOARD_URL}\n\nFor anything else, reply here and we'll get back to you.\n\nYestoryd`;
}
