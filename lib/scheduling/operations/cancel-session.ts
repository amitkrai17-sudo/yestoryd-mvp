/**
 * Cancel a session — thin WRAPPER over transitionSessionStatus (the SOLE
 * scheduled_sessions.status writer). The cancelled branch of the service owns the
 * status write, POLICY-D calendar + recall teardown, the audit log, and the
 * notify('session.cancelled') send. This wrapper only adapts the legacy signature
 * (and its SessionResult return) for existing callers (orchestrator session.cancel).
 */

import { randomUUID } from 'crypto';
import { transitionSessionStatus, type SessionDisposition } from '../transition-session-status';
import type { SessionResult } from './types';

export async function cancelSession(
  sessionId: string,
  reason: string,
  cancelledBy: string = 'system',
  // 2B.3 fault axis — forwarded to the service, merged into the SAME atomic update.
  disposition?: string,
): Promise<SessionResult> {
  try {
    const result = await transitionSessionStatus({
      sessionId,
      to: 'cancelled',
      actor: 'system',
      reason,
      disposition: disposition as SessionDisposition | undefined,
      requestId: randomUUID(),
      opts: {
        notify: true, // cancelSession has always sent notify('session.cancelled')
        extraSessionFields: { coach_notes: `Cancelled by ${cancelledBy}: ${reason}` },
      },
    });

    if (!result.ok) {
      if (result.error === 'session_not_found') return { success: false, error: 'Session not found' };
      if (result.error === 'illegal_transition' && result.from === 'completed') {
        return { success: false, error: 'Cannot cancel completed session' };
      }
      return { success: false, error: result.error ? `DB update failed: ${result.error}` : 'cancel failed' };
    }
    return { success: true, sessionId };
  } catch (error: any) {
    console.error('[SessionManager] cancelSession error:', error);
    return { success: false, error: error.message };
  }
}
