// ============================================================
// FILE: lib/backops/alert-formatter.ts
// PURPOSE: Format detected signals into email/WhatsApp/in-app alerts.
// ============================================================

import type { DetectedSignal } from './signal-detector';

/**
 * Format signals into a plain-text alert message.
 * Used for both email body and WhatsApp (if template supports it).
 * Max ~1000 chars for WhatsApp readability.
 */
export function formatAlertMessage(signals: DetectedSignal[]): string {
  if (signals.length === 0) return '';

  const criticals = signals.filter(s => s.severity === 'critical');
  const errors = signals.filter(s => s.severity === 'error');

  const lines: string[] = [];

  // Header
  if (criticals.length > 0) {
    lines.push('BACKOPS CRITICAL ALERT');
  } else if (errors.length > 0) {
    lines.push('BackOps Alert');
  } else {
    lines.push('BackOps Notice');
  }

  lines.push(`${signals.length} signal(s) detected`);
  lines.push('');

  // Top 5 signals max
  const topSignals = signals.slice(0, 5);
  for (const signal of topSignals) {
    const tag = signal.severity === 'critical' ? '[CRIT]' : signal.severity === 'error' ? '[ERR]' : '[WARN]';
    lines.push(`${tag} ${signal.title}`);
    lines.push(signal.detail.slice(0, 150));
    if (signal.suggested_commands.length > 0) {
      lines.push(`Try: ${signal.suggested_commands[0]}`);
    }
    lines.push('');
  }

  if (signals.length > 5) {
    lines.push(`+${signals.length - 5} more. Run /health for full view.`);
  }

  return lines.join('\n').trim();
}

/**
 * Format a signal as an HTML email body (for Resend).
 */
export function formatAlertEmailHtml(signals: DetectedSignal[]): string {
  if (signals.length === 0) return '';

  const criticals = signals.filter(s => s.severity === 'critical').length;
  const errors = signals.filter(s => s.severity === 'error').length;
  const warnings = signals.filter(s => s.severity === 'warning').length;

  const rows = signals.slice(0, 10).map(s => {
    const color = s.severity === 'critical' ? '#dc2626' : s.severity === 'error' ? '#ea580c' : '#ca8a04';
    return `<tr>
      <td style="padding:8px;color:${color};font-weight:bold;">${s.severity.toUpperCase()}</td>
      <td style="padding:8px;">${s.title}</td>
      <td style="padding:8px;font-size:13px;color:#666;">${s.detail.slice(0, 120)}</td>
    </tr>`;
  }).join('');

  return `
    <div style="font-family:Inter,sans-serif;max-width:600px;">
      <h2 style="margin:0 0 8px;">BackOps Signal Alert</h2>
      <p style="color:#666;margin:0 0 16px;">${criticals} critical, ${errors} errors, ${warnings} warnings</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
        <thead><tr style="background:#f9fafb;">
          <th style="padding:8px;text-align:left;">Severity</th>
          <th style="padding:8px;text-align:left;">Signal</th>
          <th style="padding:8px;text-align:left;">Detail</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${signals.length > 10 ? `<p style="color:#666;margin-top:8px;">+${signals.length - 10} more signals</p>` : ''}
      <p style="color:#999;font-size:12px;margin-top:16px;">Yestoryd BackOps - Phase 1 (observe-only)</p>
    </div>
  `;
}

/**
 * Format a signal into an in-app notification payload.
 */
export function formatInAppNotification(signal: DetectedSignal): {
  notification_type: string;
  title: string;
  body: string;
  action_url: string;
} {
  const typeMap: Record<string, string> = {
    warning: 'warning',
    error: 'error',
    critical: 'error',
  };

  return {
    notification_type: typeMap[signal.severity] || 'info',
    title: `BackOps: ${signal.title}`,
    body: signal.detail.slice(0, 300),
    action_url: '/admin/dashboard',
  };
}
