// lib/qstash.ts
// QStash client for background job processing
// Yestoryd - AI-Powered Reading Intelligence Platform
// 
// CRITICAL: QStash enables async processing for 20K+ scale
// - Payment returns in < 2 seconds
// - Calendar/Email/WhatsApp processed in background
// - Session analysis processed in background (Recall.ai)
// - Auto-retry on failure (3x)
// - No timeout issues

import { Client } from '@upstash/qstash';

// Initialize QStash client
export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// App URL - supports Vercel preview deployments
// Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > fallback to production
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 
                (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.yestoryd.com');

// ============================================================
// TYPES
// ============================================================

interface EnrollmentJobData {
  enrollmentId: string;
  childId: string;
  childName: string;
  parentId: string;
  parentEmail: string;
  parentName: string;
  parentPhone?: string;
  coachId: string;
  coachEmail: string;
  coachName: string;
  source?: 'verify' | 'webhook';
}

interface SessionProcessingData {
  botId: string;
  sessionId: string | null;
  childId: string | null;
  coachId: string | null;
  transcriptText: string;
  recordingUrl?: string;
  durationSeconds?: number;
  attendance: {
    totalParticipants: number;
    participantNames: string[];
    coachJoined: boolean;
    childJoined: boolean;
    durationMinutes: number;
    isValidSession: boolean;
  };
  requestId: string;
}

interface CommunicationJobData {
  templateCode: string;
  recipientType: 'parent' | 'coach' | 'admin';
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
  variables: Record<string, any>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

interface QueueResult {
  success: boolean;
  messageId: string | null;
  error?: string;
}

// ============================================================
// ENROLLMENT JOBS
// ============================================================

/**
 * Queue enrollment completion job via QStash
 * 
 * This is the ONLY way to process enrollments.
 * DO NOT add direct/synchronous fallback - it will break at scale!
 */
export async function queueEnrollmentComplete(data: EnrollmentJobData): Promise<QueueResult> {
  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/jobs/enrollment-complete`,
      body: data,
      retries: 3,
      delay: 0,
    });

    console.log('📤 Queued enrollment-complete job via QStash:', {
      messageId: response.messageId,
      enrollmentId: data.enrollmentId,
      childName: data.childName,
    });

    return {
      success: true,
      messageId: response.messageId,
    };
  } catch (error: any) {
    console.error('❌ QStash queue failed:', error.message);
    return {
      success: false,
      messageId: null,
      error: error.message,
    };
  }
}

// ============================================================
// SESSION PROCESSING JOBS (Recall.ai)
// ============================================================

/**
 * Queue session processing job via QStash
 * 
 * Offloads heavy processing from Recall webhook:
 * - AI transcript analysis (5-15 seconds)
 * - Audio download & storage (10-30 seconds)
 * - Embedding generation (1-3 seconds)
 * - Database updates
 * - Notification queueing
 * 
 * This allows the webhook to return in < 2 seconds
 */
export async function queueSessionProcessing(data: SessionProcessingData): Promise<QueueResult> {
  try {
    // Truncate transcript for queue payload size limits (max ~500KB)
    const truncatedData = {
      ...data,
      transcriptText: data.transcriptText.substring(0, 100000), // ~100KB max
    };

    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/jobs/process-session`,
      body: truncatedData,
      retries: 3,
      delay: 2, // 2 second delay to let any race conditions settle
    });

    console.log('📤 Queued session-processing job via QStash:', {
      messageId: response.messageId,
      sessionId: data.sessionId,
      botId: data.botId,
      transcriptLength: data.transcriptText.length,
      requestId: data.requestId,
    });

    return {
      success: true,
      messageId: response.messageId,
    };
  } catch (error: any) {
    console.error('❌ QStash session processing queue failed:', {
      error: error.message,
      sessionId: data.sessionId,
      requestId: data.requestId,
    });
    return {
      success: false,
      messageId: null,
      error: error.message,
    };
  }
}

// ============================================================
// NOTIFICATION JOBS
// ============================================================

/**
 * Queue a delayed notification
 */
export async function queueDelayedNotification(data: {
  type: 'welcome_email' | 'session_reminder' | 'followup';
  payload: any;
  delaySeconds?: number;
}): Promise<QueueResult> {
  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/jobs/send-notification`,
      body: data,
      delay: data.delaySeconds || 0,
      retries: 2,
    });

    console.log('📤 Queued notification job:', {
      messageId: response.messageId,
      type: data.type,
    });

    return { success: true, messageId: response.messageId };
  } catch (error: any) {
    console.error('❌ Failed to queue notification:', error.message);
    return { success: false, messageId: null, error: error.message };
  }
}

/**
 * Queue communication from the communication_queue table
 * Used by the communication queue processor cron job
 */
export async function queueCommunicationSend(data: CommunicationJobData): Promise<QueueResult> {
  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/jobs/send-communication`,
      body: data,
      retries: 3,
      delay: data.priority === 'urgent' ? 0 : 5, // Urgent = immediate, others = 5s delay
    });

    console.log('📤 Queued communication job:', {
      messageId: response.messageId,
      templateCode: data.templateCode,
      recipientType: data.recipientType,
      priority: data.priority,
    });

    return { success: true, messageId: response.messageId };
  } catch (error: any) {
    console.error('❌ Failed to queue communication:', error.message);
    return { success: false, messageId: null, error: error.message };
  }
}

// ============================================================
// DISCOVERY CALL JOBS
// ============================================================

/**
 * Queue discovery call notification
 * Replaces the self-HTTP call in discovery/book
 */
export async function queueDiscoveryNotification(data: {
  discoveryCallId: string;
  parentPhone: string;
  parentEmail: string;
  parentName: string;
  childName: string;
  scheduledAt: string;
  meetLink: string;
  assignedCoachName?: string;
}): Promise<QueueResult> {
  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/jobs/send-discovery-notification`,
      body: data,
      retries: 3,
      delay: 0,
    });

    console.log('📤 Queued discovery notification:', {
      messageId: response.messageId,
      discoveryCallId: data.discoveryCallId,
      parentName: data.parentName,
    });

    return { success: true, messageId: response.messageId };
  } catch (error: any) {
    console.error('❌ Failed to queue discovery notification:', error.message);
    return { success: false, messageId: null, error: error.message };
  }
}

// ============================================================
// SCHEDULE MANAGEMENT
// ============================================================

/**
 * Create a QStash schedule (recurring job)
 * Use this instead of Vercel crons when at limit
 */
export async function createQStashSchedule(config: {
  scheduleId?: string;
  url: string;
  cron: string;
  body?: any;
}) {
  try {
    const schedule = await qstash.schedules.create({
      scheduleId: config.scheduleId,
      destination: config.url,
      cron: config.cron,
      body: config.body ? JSON.stringify(config.body) : undefined,
      retries: 3,
    });

    console.log('📅 Created QStash schedule:', {
      scheduleId: schedule.scheduleId,
      cron: config.cron,
    });

    return { success: true, scheduleId: schedule.scheduleId };
  } catch (error: any) {
    console.error('❌ Failed to create schedule:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * List all QStash schedules
 */
export async function listQStashSchedules() {
  try {
    const schedules = await qstash.schedules.list();
    return { success: true, schedules };
  } catch (error: any) {
    return { success: false, error: error.message, schedules: [] };
  }
}

/**
 * Delete a QStash schedule
 */
export async function deleteQStashSchedule(scheduleId: string) {
  try {
    await qstash.schedules.delete(scheduleId);
    console.log('🗑️ Deleted QStash schedule:', scheduleId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// HOT LEAD ALERT
// ============================================================

/**
 * Queue hot lead alert for admin notification
 * Called when a child scores low on assessment (high coaching need)
 */
export async function queueHotLeadAlert(
  childId: string,
  requestId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isQStashConfigured()) {
    console.log('⚠️ QStash not configured, skipping hot lead alert');
    return { success: false, error: 'QStash not configured' };
  }

  try {
    const result = await qstash.publishJSON({
      url: `${APP_URL}/api/leads/hot-alert`,
      body: {
        childId,
        requestId,
        timestamp: new Date().toISOString(),
      },
      retries: 3,
      delay: 2, // 2 second delay
    });

    console.log('🔥 Queued hot lead alert:', {
      childId,
      messageId: result.messageId,
    });

    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error('Failed to queue hot lead alert:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// CALENDAR ATTENDEE UPDATE
// ============================================================

interface CalendarAttendeeUpdateData {
  eventId: string;
  newCoachEmail: string;
  oldCoachEmail?: string;
  requestId: string;
}

/**
 * Queue Google Calendar attendee update
 * Used when reassigning a coach to a discovery call or session
 */
export async function queueCalendarAttendeeUpdate(
  data: CalendarAttendeeUpdateData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isQStashConfigured()) {
    console.log('⚠️ QStash not configured, skipping calendar update');
    return { success: false, error: 'QStash not configured' };
  }

  try {
    const result = await qstash.publishJSON({
      url: `${APP_URL}/api/jobs/update-calendar-attendee`,
      body: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      retries: 3,
      delay: 2, // 2 second delay
    });

    console.log('📅 Queued calendar attendee update:', {
      eventId: data.eventId,
      newCoachEmail: data.newCoachEmail,
      messageId: result.messageId,
    });

    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error('Failed to queue calendar update:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// GOALS CAPTURE SCHEDULE
// ============================================================

/**
 * Setup goals capture schedule (runs every 5 minutes)
 * Sends P7 WhatsApp message 30 min after assessment if goals not captured
 *
 * Call this once during deployment or via admin endpoint
 */
export async function setupGoalsCaptureSchedule(): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  return createQStashSchedule({
    scheduleId: 'goals-capture-every-5min',
    url: `${APP_URL}/api/jobs/goals-capture`,
    cron: '*/5 * * * *', // Every 5 minutes
  });
}

/**
 * Manually trigger goals capture check (for testing)
 */
export async function triggerGoalsCaptureCheck(): Promise<QueueResult> {
  if (!isQStashConfigured()) {
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/jobs/goals-capture`,
      body: { manual: true, timestamp: new Date().toISOString() },
      retries: 1,
    });

    console.log('📤 Triggered goals capture check:', {
      messageId: response.messageId,
    });

    return { success: true, messageId: response.messageId };
  } catch (error: any) {
    console.error('❌ Failed to trigger goals capture:', error.message);
    return { success: false, messageId: null, error: error.message };
  }
}

// ============================================================
// DAILY LEAD DIGEST SCHEDULE
// ============================================================

/**
 * Setup daily lead digest schedule (runs at 9:15 AM IST daily)
 * Sends admin a summary of last 24 hours: new leads, discovery calls
 *
 * Call this once during deployment or via admin endpoint
 *
 * Note: 9:15 AM IST = 3:45 AM UTC
 */
export async function setupDailyLeadDigestSchedule(): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  return createQStashSchedule({
    scheduleId: 'daily-lead-digest-915am',
    url: `${APP_URL}/api/cron/daily-lead-digest`,
    cron: '45 3 * * *', // 9:15 AM IST (3:45 AM UTC)
  });
}

/**
 * Manually trigger daily lead digest (for testing)
 */
export async function triggerDailyLeadDigest(): Promise<QueueResult> {
  if (!isQStashConfigured()) {
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/cron/daily-lead-digest`,
      body: { manual: true, timestamp: new Date().toISOString() },
      retries: 1,
    });

    console.log('📤 Triggered daily lead digest:', {
      messageId: response.messageId,
    });

    return { success: true, messageId: response.messageId };
  } catch (error: any) {
    console.error('❌ Failed to trigger daily lead digest:', error.message);
    return { success: false, messageId: null, error: error.message };
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if QStash is properly configured
 */
export function isQStashConfigured(): boolean {
  return !!process.env.QSTASH_TOKEN;
}

/**
 * Get QStash dashboard URL for monitoring
 */
export function getQStashDashboardUrl(): string {
  return 'https://console.upstash.com/qstash';
}