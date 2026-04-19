// ============================================================
// FILE: lib/notifications/admin-alerts.ts
// ============================================================
// Admin Alert System — fire-and-forget WhatsApp notifications.
// Yestoryd — AI-Powered Reading Intelligence Platform.
//
// CRITICAL: these functions NEVER throw errors to the caller!
// Main flows (assessment, discovery) MUST NOT break if alerts fail.
//
// All sends route through the unified sendNotification() engine in
// lib/communication/notify.ts. That engine handles idempotency,
// daily caps, quiet-hours deferral, and logging to
// communication_logs. No local logging needed here.
//
// Templates (named params must match wa_variables in DB):
//   admin_new_lead_v4
//     [child_name, age, parent_name, parent_phone, location,
//      score, wpm, lead_status, timestamp]
//   admin_discovery_booked_v4
//     [child_name, age, parent_name, parent_phone,
//      scheduled_date_time, coach_name, score, wpm, timestamp]
//   admin_daily_digest_v3
//     [date, new_leads_count, hot_count, warm_count, cool_count,
//      booked_yesterday, scheduled_today, pending_followup, mtd_total]
// ============================================================

import { sendNotification } from '@/lib/communication/notify';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

// Admin phone — from env or fallback (raw-phone path in sendNotification).
const ADMIN_PHONE = COMPANY_CONFIG.adminWhatsApp;

// ============================================================
// TYPES
// ============================================================

export interface NewLeadData {
  childId: string;
  childName: string;
  childAge: number;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  location?: string;
  assessmentScore: number;
  wpm?: number;
  leadStatus: 'hot' | 'warm' | 'cool';
  requestId?: string;
}

export interface DiscoveryBookedData {
  discoveryCallId: string;
  childName: string;
  childAge?: number;
  parentName: string;
  parentPhone: string;
  scheduledAt: string;
  coachName?: string;
  assessmentScore?: number;
  wpm?: number;
  requestId?: string;
}

export interface DailyDigestData {
  date: string;                // Format: "Jan 21"
  newLeadsCount: number;
  hotCount: number;
  warmCount: number;
  coolCount: number;
  bookedYesterday: number;
  scheduledToday: number;
  pendingFollowup: number;
  mtdTotal: number;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getLeadStatusLabel(status: 'hot' | 'warm' | 'cool'): string {
  switch (status) {
    case 'hot':
      return 'HOT';
    case 'warm':
      return 'WARM';
    case 'cool':
      return 'COOL';
    default:
      return 'NEW';
  }
}

function formatTimeOnly(date: Date): string {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatScheduledDateTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(',', ' at');
}

// ============================================================
// SEND NEW LEAD ALERT
// ============================================================
// Called after assessment completion — alerts admin about new lead.

export async function sendNewLeadAlert(data: NewLeadData): Promise<boolean> {
  const startTime = Date.now();

  console.log('[AdminAlert] ========== sendNewLeadAlert START ==========');
  console.log('[AdminAlert] Child:', data.childName, 'Age:', data.childAge);
  console.log('[AdminAlert] Parent:', data.parentName, 'Phone:', data.parentPhone);
  console.log('[AdminAlert] Score:', data.assessmentScore, 'Lead Status:', data.leadStatus);
  console.log('[AdminAlert] Admin phone target:', ADMIN_PHONE);
  console.log('[AdminAlert] RequestId:', data.requestId);

  try {
    const timestamp = formatTimeOnly(new Date());
    const leadStatus = getLeadStatusLabel(data.leadStatus);

    const result = await sendNotification('admin_new_lead_v4', ADMIN_PHONE, {
      child_name: data.childName,
      age: String(data.childAge),
      parent_name: data.parentName,
      parent_phone: data.parentPhone,
      location: data.location || 'India',
      score: String(data.assessmentScore),
      wpm: String(data.wpm || 0),
      lead_status: leadStatus,
      timestamp,
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log('[AdminAlert] SUCCESS - Alert sent');
      console.log(JSON.stringify({
        event: 'admin_alert_sent',
        type: 'new_lead',
        childId: data.childId,
        leadStatus: data.leadStatus,
        duration: `${duration}ms`,
        requestId: data.requestId,
      }));
    } else {
      console.error('[AdminAlert] FAILED - reason:', result.reason);
      console.error(JSON.stringify({
        event: 'admin_alert_failed',
        type: 'new_lead',
        childId: data.childId,
        reason: result.reason,
        duration: `${duration}ms`,
        requestId: data.requestId,
      }));
    }

    console.log('[AdminAlert] ========== sendNewLeadAlert END ==========');
    return result.success;

  } catch (error: any) {
    // CRITICAL: never throw — just log and return false
    console.error('[AdminAlert] EXCEPTION:', error.message);
    console.error('[AdminAlert] Stack:', error.stack);
    console.error(JSON.stringify({
      event: 'admin_alert_error',
      type: 'new_lead',
      childId: data.childId,
      error: error.message,
      requestId: data.requestId,
    }));

    return false;
  }
}

// ============================================================
// SEND DISCOVERY BOOKED ALERT
// ============================================================
// Called when a discovery call is booked — alerts admin about upcoming call.

export async function sendDiscoveryBookedAlert(data: DiscoveryBookedData): Promise<boolean> {
  const startTime = Date.now();

  try {
    const scheduledDate = new Date(data.scheduledAt);
    const scheduledDateTime = formatScheduledDateTime(scheduledDate);
    const timestamp = formatTimeOnly(new Date());

    const result = await sendNotification('admin_discovery_booked_v4', ADMIN_PHONE, {
      child_name: data.childName,
      age: String(data.childAge || 0),
      parent_name: data.parentName,
      parent_phone: data.parentPhone,
      scheduled_date_time: scheduledDateTime,
      coach_name: data.coachName || 'Pending',
      score: String(data.assessmentScore || 0),
      wpm: String(data.wpm || 0),
      timestamp,
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(JSON.stringify({
        event: 'admin_alert_sent',
        type: 'discovery_booked',
        discoveryCallId: data.discoveryCallId,
        duration: `${duration}ms`,
        requestId: data.requestId,
      }));
    } else {
      console.error(JSON.stringify({
        event: 'admin_alert_failed',
        type: 'discovery_booked',
        discoveryCallId: data.discoveryCallId,
        reason: result.reason,
        duration: `${duration}ms`,
        requestId: data.requestId,
      }));
    }

    return result.success;

  } catch (error: any) {
    console.error(JSON.stringify({
      event: 'admin_alert_error',
      type: 'discovery_booked',
      discoveryCallId: data.discoveryCallId,
      error: error.message,
      requestId: data.requestId,
    }));

    return false;
  }
}

// ============================================================
// SEND DAILY DIGEST
// ============================================================
// Called by cron job to send daily summary.

export async function sendDailyDigest(data: DailyDigestData): Promise<boolean> {
  const startTime = Date.now();

  try {
    const result = await sendNotification('admin_daily_digest_v3', ADMIN_PHONE, {
      date: data.date,
      new_leads_count: String(data.newLeadsCount),
      hot_count: String(data.hotCount),
      warm_count: String(data.warmCount),
      cool_count: String(data.coolCount),
      booked_yesterday: String(data.bookedYesterday),
      scheduled_today: String(data.scheduledToday),
      pending_followup: String(data.pendingFollowup),
      mtd_total: String(data.mtdTotal),
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(JSON.stringify({
        event: 'admin_alert_sent',
        type: 'daily_digest',
        duration: `${duration}ms`,
      }));
    } else {
      console.error(JSON.stringify({
        event: 'admin_alert_failed',
        type: 'daily_digest',
        reason: result.reason,
        duration: `${duration}ms`,
      }));
    }

    return result.success;

  } catch (error: any) {
    console.error(JSON.stringify({
      event: 'admin_alert_error',
      type: 'daily_digest',
      error: error.message,
    }));

    return false;
  }
}
