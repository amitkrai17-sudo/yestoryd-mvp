// ============================================================
// FILE: app/api/cron/backops-signal-detector/route.ts
// PURPOSE: Signal detection cron — detect, dedup, alert, log.
//          Phase 1: observe-only, no auto-execution.
// SCHEDULE: Every 15 min via dispatcher
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { logOpsEvent, getPolicy } from '@/lib/backops';
import { detectSignals, deduplicateSignals } from '@/lib/backops/signal-detector';
import { formatAlertMessage, formatAlertEmailHtml, formatInAppNotification } from '@/lib/backops/alert-formatter';
import { sendEmail } from '@/lib/email/resend-client';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import type { OpsEntityType } from '@/lib/backops';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createAdminClient();

  try {
    // 1. Detect signals
    const allSignals = await detectSignals();

    // 2. Dedup — don't re-alert on same signal within 2h
    const signals = await deduplicateSignals(allSignals);

    // 3. Log each detected signal to ops_events
    for (const signal of signals) {
      await logOpsEvent({
        event_type: 'anomaly_detected',
        source: 'cron:backops-signal-detector',
        severity: signal.severity,
        entity_type: (signal.entity_type as OpsEntityType) || undefined,
        entity_id: signal.entity_id,
        metadata: {
          pattern: signal.pattern,
          title: signal.title,
          detail: signal.detail,
          suggested_commands: signal.suggested_commands,
          event_count: signal.raw_events.length,
        } as Json,
      });
    }

    // 4. Send alerts if signals detected
    if (signals.length > 0) {
      // Email alert (Phase 1 primary channel — no AiSensy template needed)
      try {
        const textBody = formatAlertMessage(signals);
        const htmlBody = formatAlertEmailHtml(signals);
        const severity = signals[0].severity;

        await sendEmail({
          to: COMPANY_CONFIG.adminEmail,
          subject: `BackOps ${severity.toUpperCase()}: ${signals.length} signal(s) — ${signals[0].title}`,
          html: htmlBody,
          text: textBody,
          from: { email: COMPANY_CONFIG.supportEmail, name: 'Yestoryd BackOps' },
        });
      } catch (alertErr) {
        console.error('[BackOps] Email alert failed:', alertErr instanceof Error ? alertErr.message : alertErr);
      }

      // In-app notifications for critical/error signals
      const criticalOrError = signals.filter(s => s.severity === 'critical' || s.severity === 'error');
      for (const signal of criticalOrError) {
        try {
          const notification = formatInAppNotification(signal);
          await supabase.from('in_app_notifications').insert({
            user_id: 'system',
            user_type: 'admin',
            title: notification.title,
            body: notification.body,
            notification_type: notification.notification_type,
            action_url: notification.action_url,
          });
        } catch (notifErr) {
          console.error('[BackOps] In-app notification failed:', notifErr instanceof Error ? notifErr.message : notifErr);
        }
      }
    }

    // 5. Log scan completion
    const duration = Date.now() - startTime;
    const bySeverity = {
      critical: signals.filter(s => s.severity === 'critical').length,
      error: signals.filter(s => s.severity === 'error').length,
      warning: signals.filter(s => s.severity === 'warning').length,
    };

    await logOpsEvent({
      event_type: signals.length > 0 ? 'system_alert' : 'cron_run',
      source: 'cron:backops-signal-detector',
      severity: bySeverity.critical > 0 ? 'warning' : 'info',
      metadata: {
        signals_detected: signals.length,
        deduped_from: allSignals.length,
        by_severity: bySeverity,
        alerts_sent: signals.length > 0,
        duration_ms: duration,
      } as Json,
    });

    return NextResponse.json({
      success: true,
      signals_detected: signals.length,
      deduped_from: allSignals.length,
      by_severity: bySeverity,
      alerts_sent: signals.length > 0,
      duration_ms: duration,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BackOps Signal Detector] Fatal:', errMsg);

    try {
      await logOpsEvent({
        event_type: 'cron_failure',
        source: 'cron:backops-signal-detector',
        severity: 'error',
        metadata: { error: errMsg } as Json,
      });
    } catch { /* swallow */ }

    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}

// Support POST for dispatcher calls
export const POST = GET;
