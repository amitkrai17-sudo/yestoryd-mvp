// ============================================================
// FILE: lib/notifications/admin-alerts.ts
// ============================================================
// Admin Alert System - Fire-and-forget WhatsApp notifications
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// CRITICAL: These functions NEVER throw errors to the caller!
// Main flows (assessment, discovery) MUST NOT break if alerts fail.
//
// Uses AiSensy templates:
// - admin_new_lead: {{1}}=childName, {{2}}=age, {{3}}=parentName, {{4}}=parentPhone, {{5}}=location, {{6}}=score, {{7}}=wpm, {{8}}=leadStatus, {{9}}=timestamp
// - admin_discovery_booked: {{1}}=childName, {{2}}=age, {{3}}=parentName, {{4}}=parentPhone, {{5}}=scheduledDateTime, {{6}}=coachName, {{7}}=score, {{8}}=wpm, {{9}}=timestamp
// - admin_daily_digest: {{1}}=date, {{2}}=newLeadsCount, {{3}}=hotCount, {{4}}=warmCount, {{5}}=coolCount, {{6}}=bookedYesterday, {{7}}=scheduledToday, {{8}}=pendingFollowup, {{9}}=mtdTotal
//
// Usage:
//   sendNewLeadAlert(leadData).catch(err => console.error('Alert failed:', err));
//
// ============================================================

import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import { getServiceSupabase } from '@/lib/api-auth';

// Admin phone - from env or fallback
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP_PHONE || '+919687606177';

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
// Called after assessment completion - alerts admin about new lead
//
// Template: admin_new_lead (9 variables)
// {{1}}=childName, {{2}}=age, {{3}}=parentName, {{4}}=parentPhone,
// {{5}}=location, {{6}}=score, {{7}}=wpm, {{8}}=leadStatus, {{9}}=timestamp

export async function sendNewLeadAlert(data: NewLeadData): Promise<boolean> {
  const startTime = Date.now();

  // DETAILED LOGGING: Track full flow
  console.log('[AdminAlert] ========== sendNewLeadAlert START ==========');
  console.log('[AdminAlert] Child:', data.childName, 'Age:', data.childAge);
  console.log('[AdminAlert] Parent:', data.parentName, 'Phone:', data.parentPhone);
  console.log('[AdminAlert] Score:', data.assessmentScore, 'Lead Status:', data.leadStatus);
  console.log('[AdminAlert] Admin phone target:', ADMIN_PHONE);
  console.log('[AdminAlert] RequestId:', data.requestId);

  try {
    const timestamp = formatTimeOnly(new Date());
    const leadStatus = getLeadStatusLabel(data.leadStatus);

    const templateVariables = [
      data.childName,                   // {{1}} - Child name
      String(data.childAge),            // {{2}} - Age
      data.parentName,                  // {{3}} - Parent name
      data.parentPhone,                 // {{4}} - Parent phone
      data.location || 'India',         // {{5}} - Location
      String(data.assessmentScore),     // {{6}} - Score
      String(data.wpm || 0),            // {{7}} - WPM
      leadStatus,                       // {{8}} - Lead status (HOT/WARM/COOL)
      timestamp,                        // {{9}} - Timestamp (hh:mm AM/PM)
    ];

    console.log('[AdminAlert] Template: admin_new_lead');
    console.log('[AdminAlert] Variables:', JSON.stringify(templateVariables));
    console.log('[AdminAlert] Sending to AiSensy...');

    // Send WhatsApp alert using template
    const result = await sendWhatsAppMessage({
      to: ADMIN_PHONE,
      templateName: 'admin_new_lead',
      variables: templateVariables,
    });

    console.log('[AdminAlert] AiSensy response:', JSON.stringify(result));

    const duration = Date.now() - startTime;

    // Log to communication_logs (non-blocking)
    console.log('[AdminAlert] Logging to DB...');
    logAdminAlert({
      alertType: 'new_lead',
      relatedEntityType: 'child',
      relatedEntityId: data.childId,
      success: result.success,
      errorMessage: result.error,
      variables: {
        child_name: data.childName,
        parent_name: data.parentName,
        score: data.assessmentScore,
        wpm: data.wpm,
        lead_status: data.leadStatus,
        request_id: data.requestId,
      },
      duration,
    }).catch(err => console.error('[AdminAlert] DB log failed:', err));

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
      console.error('[AdminAlert] FAILED - AiSensy error:', result.error);
      console.error(JSON.stringify({
        event: 'admin_alert_failed',
        type: 'new_lead',
        childId: data.childId,
        error: result.error,
        duration: `${duration}ms`,
        requestId: data.requestId,
      }));
    }

    console.log('[AdminAlert] ========== sendNewLeadAlert END ==========');
    return result.success;

  } catch (error: any) {
    // CRITICAL: Never throw - just log and return false
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
// Called when a discovery call is booked - alerts admin about upcoming call
//
// Template: admin_discovery_booked (9 variables)
// {{1}}=childName, {{2}}=age, {{3}}=parentName, {{4}}=parentPhone,
// {{5}}=scheduledDateTime, {{6}}=coachName, {{7}}=score, {{8}}=wpm, {{9}}=timestamp

export async function sendDiscoveryBookedAlert(data: DiscoveryBookedData): Promise<boolean> {
  const startTime = Date.now();

  try {
    const scheduledDate = new Date(data.scheduledAt);
    const scheduledDateTime = formatScheduledDateTime(scheduledDate);
    const timestamp = formatTimeOnly(new Date());

    // Send WhatsApp alert using template
    const result = await sendWhatsAppMessage({
      to: ADMIN_PHONE,
      templateName: 'admin_discovery_booked',
      variables: [
        data.childName,                       // {{1}} - Child name
        String(data.childAge || 0),           // {{2}} - Age
        data.parentName,                      // {{3}} - Parent name
        data.parentPhone,                     // {{4}} - Parent phone
        scheduledDateTime,                    // {{5}} - Scheduled date/time (Jan 21, 2026 at 10:00 AM)
        data.coachName || 'Pending',          // {{6}} - Coach name
        String(data.assessmentScore || 0),    // {{7}} - Score
        String(data.wpm || 0),                // {{8}} - WPM
        timestamp,                            // {{9}} - Timestamp (hh:mm AM/PM)
      ],
    });

    const duration = Date.now() - startTime;

    // Log to communication_logs (non-blocking)
    logAdminAlert({
      alertType: 'discovery_booked',
      relatedEntityType: 'discovery_call',
      relatedEntityId: data.discoveryCallId,
      success: result.success,
      variables: {
        child_name: data.childName,
        parent_name: data.parentName,
        scheduled_at: data.scheduledAt,
        coach_name: data.coachName,
        score: data.assessmentScore,
        wpm: data.wpm,
        request_id: data.requestId,
      },
      duration,
    }).catch(err => console.error('Failed to log alert:', err));

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
        error: result.error,
        duration: `${duration}ms`,
        requestId: data.requestId,
      }));
    }

    return result.success;

  } catch (error: any) {
    // CRITICAL: Never throw - just log and return false
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
// Called by cron job to send daily summary
//
// Template: admin_daily_digest (9 variables)
// {{1}}=date, {{2}}=newLeadsCount, {{3}}=hotCount, {{4}}=warmCount,
// {{5}}=coolCount, {{6}}=bookedYesterday, {{7}}=scheduledToday, {{8}}=pendingFollowup, {{9}}=mtdTotal

export async function sendDailyDigest(data: DailyDigestData): Promise<boolean> {
  const startTime = Date.now();

  try {
    // Send WhatsApp alert using template
    const result = await sendWhatsAppMessage({
      to: ADMIN_PHONE,
      templateName: 'admin_daily_digest',
      variables: [
        data.date,                            // {{1}} - Date (Jan 21)
        String(data.newLeadsCount),           // {{2}} - New leads count
        String(data.hotCount),                // {{3}} - Hot count
        String(data.warmCount),               // {{4}} - Warm count
        String(data.coolCount),               // {{5}} - Cool count
        String(data.bookedYesterday),         // {{6}} - Booked yesterday
        String(data.scheduledToday),          // {{7}} - Scheduled today
        String(data.pendingFollowup),         // {{8}} - Pending followup
        String(data.mtdTotal),                // {{9}} - MTD total
      ],
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
        error: result.error,
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

// ============================================================
// LOG ADMIN ALERT TO DB
// ============================================================
// Non-blocking logging to communication_logs table
//
// CORRECT COLUMNS (as of Jan 2026):
// - template_code (text)
// - recipient_type (text)
// - recipient_phone (text)
// - recipient_email (text)
// - wa_sent (boolean)
// - email_sent (boolean)
// - sms_sent (boolean)
// - context_data (jsonb)
// - error_message (text)
// - sent_at (timestamptz)

async function logAdminAlert(params: {
  alertType: string;
  relatedEntityType: string;
  relatedEntityId: string;
  success: boolean;
  errorMessage?: string;
  variables: Record<string, any>;
  duration: number;
}): Promise<void> {
  try {
    const supabase = getServiceSupabase();

    // Use CORRECT column names for communication_logs table
    const insertData = {
      template_code: `admin_${params.alertType}`,
      recipient_type: 'admin',
      recipient_phone: ADMIN_PHONE,
      recipient_email: null,
      wa_sent: params.success,
      email_sent: false,
      sms_sent: false,
      context_data: {
        ...params.variables,
        related_entity_type: params.relatedEntityType,
        related_entity_id: params.relatedEntityId,
        duration_ms: params.duration,
      },
      error_message: params.success ? null : (params.errorMessage || 'Unknown error'),
      sent_at: params.success ? new Date().toISOString() : null,
    };

    console.log('[AdminAlert] DB insert data:', JSON.stringify(insertData));

    const { error: insertError } = await supabase.from('communication_logs').insert(insertData);

    if (insertError) {
      console.error('[AdminAlert] DB insert error:', insertError.message);
      console.error('[AdminAlert] DB error details:', JSON.stringify(insertError));
    } else {
      console.log('[AdminAlert] DB log successful');
    }
  } catch (error: any) {
    // Never throw from logging
    console.error('[AdminAlert] DB log exception:', error.message);
    console.error('[AdminAlert] DB exception stack:', error.stack);
  }
}
