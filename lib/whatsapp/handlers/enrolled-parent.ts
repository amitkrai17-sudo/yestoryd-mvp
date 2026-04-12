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

function displayName(child: EnrolledChild): string {
  return firstWord(child.child_name || child.name, 'your child');
}

/**
 * Find the child whose name appears in the message. Matches on first name
 * (case-insensitive, word-boundary via simple includes). Returns null if
 * no child name is mentioned or multiple children match the same token.
 */
function resolveChildFromMessage(message: string, children: EnrolledChild[]): EnrolledChild | null {
  const lower = (message || '').toLowerCase();
  const matches = children.filter((c) => {
    const first = displayName(c).toLowerCase();
    if (first === 'your' || first === 'child') return false;
    return lower.includes(first);
  });
  return matches.length === 1 ? matches[0] : null;
}

function buildDisambiguationPrompt(children: EnrolledChild[]): string {
  const lines = children
    .map((c, i) => `${i + 1}. ${displayName(c)}`)
    .join('\n');
  return `You have multiple children enrolled with Yestoryd:\n\n${lines}\n\nWhich child is this about? Reply with their name.\n\nYestoryd`;
}

function buildResponseForChild(message: string, child: EnrolledChild): string {
  const childName = displayName(child);
  const coachName = firstWord(child.coachName, 'your coach');
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

export async function handleEnrolledParent(
  _phone: string,
  message: string,
  children: EnrolledChild[]
): Promise<string> {
  if (children.length === 0) {
    return `Hi! For session details, practice tasks, and progress — check the dashboard:\n${DASHBOARD_URL}\n\nYestoryd`;
  }

  if (children.length === 1) {
    return buildResponseForChild(message, children[0]);
  }

  const matched = resolveChildFromMessage(message, children);
  if (matched) {
    return buildResponseForChild(message, matched);
  }

  return buildDisambiguationPrompt(children);
}
