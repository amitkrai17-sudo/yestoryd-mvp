// ============================================================
// FILE: lib/tuition/balance-tracker.ts
// PURPOSE: Shared helper for tuition session balance deduction,
//          ledger writes, low-balance alerts, and pause checks.
//          Called after any session completion for tuition enrollments.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/communication/notify';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

interface DeductResult {
  deducted: boolean;
  newBalance: number;
  alertSent: 'none' | 'low_balance' | 'renewal' | 'paused';
  error?: string;
  /**
   * True when the deduct was a no-op because this session was already processed
   * (ledger insert hit the partial unique index → PG 23505). Additive — existing
   * callers ignore it. See deductTuitionBalance INSERT-FIRST guard (2B.1).
   */
  idempotentSkip?: boolean;
}

/**
 * Deduct sessions from a tuition enrollment and handle alerts.
 * Called after session completion for tuition enrollments.
 *
 * @param enrollmentId - The tuition enrollment ID
 * @param sessionId - The completed session ID
 * @param sessionsDelivered - Number of sessions delivered (1 or 2)
 * @param coachEmail - Who performed the deduction
 * @param requestId - For logging
 */
export async function deductTuitionBalance(
  enrollmentId: string,
  sessionId: string,
  sessionsDelivered: number,
  coachEmail: string,
  requestId: string,
): Promise<DeductResult> {
  const supabase = createAdminClient();

  try {
    // 1. Fetch enrollment with child/parent info
    const { data: enrollment, error: fetchErr } = await supabase
      .from('enrollments')
      .select('id, sessions_remaining, sessions_completed, child_id, parent_id, coach_id, session_rate, enrollment_type, status, is_paused, renewal_intent, renewal_intent_set_at, low_balance_nudges_sent, last_low_balance_nudge_at, parent_renewal_check_sent_at')
      .eq('id', enrollmentId)
      .single();

    if (fetchErr || !enrollment) {
      return { deducted: false, newBalance: 0, alertSent: 'none', error: 'Enrollment not found' };
    }

    if (enrollment.enrollment_type !== 'tuition') {
      return { deducted: false, newBalance: 0, alertSent: 'none', error: 'Not a tuition enrollment' };
    }

    const previousBalance = enrollment.sessions_remaining || 0;
    const newBalance = previousBalance - sessionsDelivered;

    // 2. INSERT-FIRST idempotency gate (2B.1). The ledger insert is keyed by
    // session_id via the partial unique index uniq_tuition_ledger_deduct_session
    // (session_id WHERE reason='session_completed'). It runs BEFORE the balance
    // decrement so a repeated deduct for the same session is a no-op:
    //   - PG 23505 (unique_violation) → already processed → SKIP decrement, return
    //     idempotentSkip:true. Do NOT throw.
    //   - any OTHER insert error → the ledger row is the gate, so the decrement
    //     does NOT run (intended failure-semantics flip vs pre-2B.1: no decrement
    //     without a committed ledger row).
    //   - clean insert → proceed to decrement EXACTLY as today (negative-allowed).
    const { error: ledgerError } = await supabase
      .from('tuition_session_ledger')
      .insert({
        enrollment_id: enrollmentId,
        change_amount: -sessionsDelivered,
        balance_after: newBalance,
        reason: 'session_completed',
        session_id: sessionId,
        created_by: coachEmail,
      });

    if (ledgerError) {
      if (ledgerError.code === '23505') {
        console.log(JSON.stringify({
          requestId,
          event: 'deduct_idempotent_skip',
          enrollmentId,
          sessionId,
          previousBalance,
        }));
        return { deducted: false, newBalance: previousBalance, alertSent: 'none', idempotentSkip: true };
      }
      console.error(JSON.stringify({
        requestId,
        event: 'tuition_ledger_insert_error',
        enrollmentId,
        sessionId,
        error: ledgerError.message,
      }));
      return { deducted: false, newBalance: previousBalance, alertSent: 'none', error: ledgerError.message };
    }

    // 3. Deduct balance (can go negative — draft mode). Runs ONLY after a clean
    // ledger insert — the ledger row is the idempotency gate. In the SAME atomic
    // update, increment sessions_completed so completed↔deduct can never diverge.
    // SEMANTICS (2B.2): for tuition, sessions_completed = BILLED sessions (ledger
    // deduct count), NOT delivered. It may trail scheduled_sessions delivered-count
    // by design (e.g. a delivered-but-unbilled session). Hygiene column; the only
    // reader is the coaching dashboard (coaching enrollments, not tuition).
    await supabase
      .from('enrollments')
      .update({
        sessions_remaining: newBalance,
        sessions_completed: (enrollment.sessions_completed || 0) + sessionsDelivered,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    console.log(JSON.stringify({
      requestId,
      event: 'tuition_balance_deducted',
      enrollmentId,
      sessionId,
      sessionsDelivered,
      previousBalance,
      newBalance,
    }));

    // 4. Fetch child + parent for alerts
    let childName = 'Student';
    let parentPhone: string | null = null;
    let parentName = 'Parent';

    if (enrollment.child_id) {
      const { data: child } = await supabase
        .from('children')
        .select('child_name, parent_phone')
        .eq('id', enrollment.child_id)
        .single();
      if (child) {
        childName = child.child_name || 'Student';
        parentPhone = child.parent_phone;
      }
    }

    if (enrollment.parent_id) {
      const { data: parent } = await supabase
        .from('parents')
        .select('name, phone')
        .eq('id', enrollment.parent_id)
        .single();
      if (parent) {
        parentName = parent.name || 'Parent';
        if (!parentPhone) parentPhone = parent.phone;
      }
    }

    let alertSent: DeductResult['alertSent'] = 'none';

    // 5. Balance alerts
    if (newBalance <= 0) {
      // Zero or negative — send renewal link
      if (parentPhone) {
        try {
          const result = await sendNotification('parent_tuition_renewal_v3', parentPhone, {
            parent_name: parentName,
            child_name: childName,
          }, {
            templateButtons: { category: 'utility_cta', url: enrollmentId },
          });
          if (result.success) {
            alertSent = 'renewal';
          } else {
            console.error(JSON.stringify({
              requestId, event: 'tuition_renewal_wa_failed',
              enrollmentId, phone: parentPhone, reason: result.reason,
            }));
          }
        } catch (waErr) {
          const errMsg = waErr instanceof Error ? waErr.message : String(waErr);
          console.error(JSON.stringify({
            requestId, event: 'tuition_renewal_wa_exception',
            enrollmentId, phone: parentPhone, error: errMsg,
          }));
        }
      }

      console.log(JSON.stringify({
        requestId,
        event: 'tuition_renewal_alert_sent',
        enrollmentId,
        newBalance,
        alertSent,
      }));

      // 6. Pause check — only if balance has been at 0 for 3+ days
      await checkAndPause(enrollmentId, newBalance, childName, parentPhone, parentName, requestId);

    } else if (newBalance === 1 && !enrollment.parent_renewal_check_sent_at) {
      // BATCH-3-INBOUND: Renewal intent capture — fires once per cycle at
      // sessions_remaining=1. Idempotent via parent_renewal_check_sent_at.
      // Reset to NULL when parent tops up (handled by addTuitionBalance helper).
      if (parentPhone) {
        try {
          const result = await sendNotification('parent_renewal_intent_v1', parentPhone, {
            parent_name: parentName,
            child_name: childName,
          }, {
            templateButtons: {
              category: 'marketing_quick_reply',
              payloads: [
                { id: 'btn_renew_yes',   title: 'Yes, renew' },
                { id: 'btn_renew_pause', title: 'Pause for now' },
                { id: 'btn_renew_talk',  title: 'Talk to coach' },
              ],
            },
            contextType: 'enrollment',
            contextId: enrollmentId,
          });
          if (result.success) {
            await supabase
              .from('enrollments')
              .update({ parent_renewal_check_sent_at: new Date().toISOString() })
              .eq('id', enrollmentId);
            alertSent = 'low_balance';
          } else {
            console.error(JSON.stringify({
              requestId, event: 'renewal_intent_wa_failed',
              enrollmentId, phone: parentPhone, reason: result.reason,
            }));
          }
        } catch (waErr) {
          const errMsg = waErr instanceof Error ? waErr.message : String(waErr);
          console.error(JSON.stringify({
            requestId, event: 'renewal_intent_wa_exception',
            enrollmentId, phone: parentPhone, error: errMsg,
          }));
        }
      }

      console.log(JSON.stringify({
        requestId,
        event: 'renewal_intent_capture_sent',
        enrollmentId,
        newBalance,
      }));
    } else if (newBalance <= 2) {
      // ── Spam prevention guards (added 2026-04-26 for parent_tuition_low_balance_v3) ──
      // Defensive: pause is currently set via status='tuition_paused', is_paused flag
      // is dormant in production. Check both to prevent latent bug.
      if (enrollment.is_paused === true || enrollment.status === 'tuition_paused') {
        await supabase.from('activity_log').insert({
          action: 'low_balance_skipped',
          user_email: COMPANY_CONFIG.supportEmail,
          user_type: 'system',
          metadata: {
            enrollment_id: enrollment.id,
            child_id: enrollment.child_id,
            skip_reason: 'paused',
            sessions_remaining: newBalance,
          },
        });
        return { deducted: true, newBalance, alertSent: 'none' };
      }

      // Renewal intent: only fire to parents who are 'pending' or 'needs_more_info'.
      // Honors declined intent and stops nudging confirmed renewals.
      const intent = enrollment.renewal_intent ?? 'pending';
      if (!['pending', 'needs_more_info'].includes(intent)) {
        await supabase.from('activity_log').insert({
          action: 'low_balance_skipped',
          user_email: COMPANY_CONFIG.supportEmail,
          user_type: 'system',
          metadata: {
            enrollment_id: enrollment.id,
            child_id: enrollment.child_id,
            skip_reason: `intent_${intent}`,
            sessions_remaining: newBalance,
          },
        });
        return { deducted: true, newBalance, alertSent: 'none' };
      }

      // Lifetime nudge cap: max 2 nudges per enrollment, ever.
      const nudgesSent = enrollment.low_balance_nudges_sent ?? 0;
      if (nudgesSent >= 2) {
        await supabase.from('activity_log').insert({
          action: 'low_balance_skipped',
          user_email: COMPANY_CONFIG.supportEmail,
          user_type: 'system',
          metadata: {
            enrollment_id: enrollment.id,
            child_id: enrollment.child_id,
            skip_reason: 'cap_reached',
            nudges_sent: nudgesSent,
            sessions_remaining: newBalance,
          },
        });
        return { deducted: true, newBalance, alertSent: 'none' };
      }

      // Low balance alert
      if (parentPhone) {
        try {
          const result = await sendNotification('parent_tuition_low_balance_v3', parentPhone, {
            parent_name: parentName,
            child_name: childName,
            new_balance: String(newBalance),
          }, {
            templateButtons: { category: 'utility_cta', url: enrollmentId },
          });
          if (result.success) {
            alertSent = 'low_balance';
            await supabase
              .from('enrollments')
              .update({
                low_balance_nudges_sent: nudgesSent + 1,
                last_low_balance_nudge_at: new Date().toISOString(),
              })
              .eq('id', enrollment.id);
          } else {
            console.error(JSON.stringify({
              requestId, event: 'tuition_low_balance_wa_failed',
              enrollmentId, phone: parentPhone, reason: result.reason,
            }));
          }
        } catch (waErr) {
          const errMsg = waErr instanceof Error ? waErr.message : String(waErr);
          console.error(JSON.stringify({
            requestId, event: 'tuition_low_balance_wa_exception',
            enrollmentId, phone: parentPhone, error: errMsg,
          }));
        }
      }

      console.log(JSON.stringify({
        requestId,
        event: 'tuition_low_balance_alert',
        enrollmentId,
        newBalance,
        alertSent,
      }));
    }

    return { deducted: true, newBalance, alertSent };
  } catch (err) {
    console.error(JSON.stringify({
      requestId,
      event: 'tuition_balance_deduct_error',
      enrollmentId,
      error: err instanceof Error ? err.message : String(err),
    }));
    return { deducted: false, newBalance: 0, alertSent: 'none', error: 'Deduction failed' };
  }
}

/**
 * Check if a tuition enrollment should be paused.
 * Pauses if balance has been <= 0 for 3+ days.
 */
async function checkAndPause(
  enrollmentId: string,
  currentBalance: number,
  childName: string,
  parentPhone: string | null,
  parentName: string,
  requestId: string,
): Promise<void> {
  if (currentBalance > 0) return;

  const supabase = createAdminClient();

  // Find when balance first hit 0 or negative
  const { data: zeroEntry } = await supabase
    .from('tuition_session_ledger')
    .select('created_at')
    .eq('enrollment_id', enrollmentId)
    .lte('balance_after', 0)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!zeroEntry) return;

  const daysSinceZero = (Date.now() - new Date(zeroEntry.created_at!).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceZero < 3) return;

  // Check if already paused
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('status')
    .eq('id', enrollmentId)
    .single();

  if (enrollment?.status === 'tuition_paused') return;

  // Pause
  await supabase
    .from('enrollments')
    .update({
      status: 'tuition_paused',
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);

  // Send paused WA
  if (parentPhone) {
    try {
      const result = await sendNotification('parent_tuition_paused_v3', parentPhone, {
        parent_name: parentName,
        child_name: childName,
      }, {
        templateButtons: { category: 'utility_cta', url: enrollmentId },
      });
      if (!result.success) {
        console.error(JSON.stringify({
          requestId, event: 'tuition_paused_wa_failed',
          enrollmentId, phone: parentPhone, reason: result.reason,
        }));
      }
    } catch (waErr) {
      const errMsg = waErr instanceof Error ? waErr.message : String(waErr);
      console.error(JSON.stringify({
        requestId, event: 'tuition_paused_wa_exception',
        enrollmentId, phone: parentPhone, error: errMsg,
      }));
    }
  }

  // Activity log
  await supabase.from('activity_log').insert({
    action: 'tuition_enrollment_paused',
    user_email: COMPANY_CONFIG.supportEmail,
    user_type: 'system',
    metadata: {
      enrollment_id: enrollmentId,
      child_name: childName,
      days_since_zero: Math.floor(daysSinceZero),
      current_balance: currentBalance,
    },
  });

  console.log(JSON.stringify({
    requestId,
    event: 'tuition_enrollment_paused',
    enrollmentId,
    daysSinceZero: Math.floor(daysSinceZero),
    currentBalance,
  }));
}
