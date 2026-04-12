// ============================================================
// FILE: lib/whatsapp/handlers/enrolled-parent.ts
// PURPOSE: Handle inbound Lead Bot (8591) messages that arrive from an
//          already-enrolled parent. Redirects to dashboard / coach /
//          support rather than running the lead-qualification funnel.
//
// Returns a string reply when the message is clearly about the child's
// enrollment (session / practice / payment / cancel keywords). Returns
// null for general questions ("how is english classes different from
// coaching") so the caller can fall through to the normal FAQ path ???
// those don't need child context and benefit from a Gemini answer.
// ============================================================

import type { EnrolledChild } from '@/lib/whatsapp/enrolled-parent-lookup';

const DASHBOARD_URL = 'https://yestoryd.com/parent';
const SUPPORT_EMAIL = 'engage@yestoryd.com';

type KeywordBucket = 'session' | 'practice' | 'payment' | 'cancel';

function firstWord(full: string | null | undefined, fallback: string): string {
  if (!full) return fallback;
  return full.split(/\s+/)[0] || fallback;
}

function displayName(child: EnrolledChild): string {
  return firstWord(child.child_name || child.name, 'your child');
}

/**
 * Classify the message into a child-context keyword bucket, or null if none
 * match. Only bucketed messages get an enrolled-parent response; everything
 * else falls through to the Lead Bot FAQ.
 */
function detectKeywordBucket(message: string): KeywordBucket | null {
  const lower = (message || '').toLowerCase();

  // 'class' alone is too greedy ??? matches "english classes" which is a product
  // question, not a session query. Use specific phrases that indicate a
  // scheduled session ("next class", "my class", "today class") so product
  // inquiries fall through to the FAQ handler.
  if (
    lower.includes('session') ||
    lower.includes('next class') ||
    lower.includes('my class') ||
    lower.includes('today class') ||
    lower.includes('schedule')
  ) return 'session';

  if (lower.includes('practice') || lower.includes('homework') || lower.includes('task')) return 'practice';
  if (lower.includes('pay') || lower.includes('fee') || lower.includes('renew')) return 'payment';
  if (lower.includes('cancel') || lower.includes('stop') || lower.includes('pause')) return 'cancel';
  return null;
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

function buildResponseForBucket(bucket: KeywordBucket, child: EnrolledChild): string {
  const childName = displayName(child);
  const coachName = firstWord(child.coachName, 'your coach');

  switch (bucket) {
    case 'session':
      return `For ${childName}'s session details, please check the dashboard:\n${DASHBOARD_URL}\n\nFor scheduling changes, please contact ${coachName} directly.\n\nYestoryd`;
    case 'practice':
      return `${childName}'s practice tasks are on the dashboard:\n${DASHBOARD_URL}\n\nYestoryd`;
    case 'payment':
      return `For payment and renewal queries, please check the dashboard or contact us at ${SUPPORT_EMAIL}\n\n${DASHBOARD_URL}\n\nYestoryd`;
    case 'cancel':
      return `For enrollment changes, please contact us at ${SUPPORT_EMAIL} or call Rucha directly.\n\nYestoryd`;
  }
}

/**
 * Returns an enrolled-parent response string, or null to signal the caller
 * should fall through to the normal Lead Bot FAQ flow.
 */
export async function handleEnrolledParent(
  _phone: string,
  message: string,
  children: EnrolledChild[]
): Promise<string | null> {
  if (children.length === 0) return null;

  const bucket = detectKeywordBucket(message);
  if (!bucket) {
    // General question ??? let the FAQ handler answer it.
    return null;
  }

  if (children.length === 1) {
    return buildResponseForBucket(bucket, children[0]);
  }

  const matched = resolveChildFromMessage(message, children);
  if (matched) {
    return buildResponseForBucket(bucket, matched);
  }

  return buildDisambiguationPrompt(children);
}

