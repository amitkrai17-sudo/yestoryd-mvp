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
      .select('id, sessions_remaining, child_id, parent_id, coach_id, session_rate, enrollment_type, status, is_paused, renewal_intent, renewal_intent_set_at, low_balance_nudges_sent, last_low_balance_nudge_at')
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

    // 2. Deduct balance (can go negative — draft mode)
    await supabase
      .from('enrollments')
      .update({
        sessions_remaining: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    // 3. Ledger entry
    await supabase.from('tuition_session_ledger').insert({
      enrollment_id: enrollmentId,
      change_amount: -sessionsDelivered,
      balance_after: newBalance,
      reason: 'session_completed',
      session_id: sessionId,
      created_by: coachEmail,
    });

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
      const renewalUrl = `${APP_URL}/tuition/pay/${enrollmentId}?renewal=true`;

      if (parentPhone) {
        try {
          const result = await sendNotification('parent_tuition_renewal_v3', parentPhone, {
            parent_first_name: parentName.split(' ')[0],
            child_first_name: childName.split(' ')[0],
            renewal_url: renewalUrl,
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
      const renewalUrl = `${APP_URL}/tuition/pay/${enrollmentId}?renewal=true`;

      if (parentPhone) {
        try {
          const result = await sendNotification('parent_tuition_low_balance_v3', parentPhone, {
            parent_first_name: parentName.split(' ')[0],
            child_first_name: childName.split(' ')[0],
            new_balance: String(newBalance),
            renewal_url: renewalUrl,
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
  const renewalUrl = `${APP_URL}/tuition/pay/${enrollmentId}?renewal=true`;

  if (parentPhone) {
    try {
      const result = await sendNotification('parent_tuition_paused_v3', parentPhone, {
        parent_first_name: parentName.split(' ')[0],
        child_first_name: childName.split(' ')[0],
        renewal_url: renewalUrl,
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
