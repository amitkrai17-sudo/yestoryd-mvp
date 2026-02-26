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

// Initialize QStash client (conditionally - only if token is set)
export const qstash = process.env.QSTASH_TOKEN
  ? new Client({ token: process.env.QSTASH_TOKEN })
  : null;

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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping enrollment-complete job');
    return {
      success: false,
      messageId: null,
      error: 'QStash not configured',
    };
  }

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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping session-processing job');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping delayed notification');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping communication send');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping discovery notification');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping schedule creation');
    return { success: false, error: 'QStash not configured' };
  }

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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, cannot list schedules');
    return { success: false, error: 'QStash not configured', schedules: [] };
  }

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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, cannot delete schedule');
    return { success: false, error: 'QStash not configured' };
  }

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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping hot lead alert');
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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping calendar update');
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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, cannot trigger goals capture');
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
// SESSION COMPLETION NUDGE SCHEDULE
// ============================================================

/**
 * Setup session completion nudge schedule (runs every 15 minutes)
 * Replaced Vercel cron (Hobby plan only allows daily crons)
 *
 * Call this once during deployment or via admin endpoint
 */
export async function setupSessionCompletionNudgeSchedule(): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  return createQStashSchedule({
    scheduleId: 'session-completion-nudge-15min',
    url: `${APP_URL}/api/cron/session-completion-nudge`,
    cron: '*/15 * * * *', // Every 15 minutes
  });
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
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, cannot trigger daily digest');
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
// ASSESSMENT RETRY
// ============================================================

/**
 * Queue a failed assessment for retry (5 minute delay)
 * Called when all AI providers fail during assessment
 */
export async function queueAssessmentRetry(data: {
  pendingAssessmentId: string;
  requestId: string;
}): Promise<QueueResult> {
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping assessment retry');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/assessment/retry`,
      body: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      retries: 2,
      delay: 300, // 5 minutes
    });

    console.log('[QSTASH] Queued assessment retry:', {
      messageId: response.messageId,
      pendingAssessmentId: data.pendingAssessmentId,
    });

    return { success: true, messageId: response.messageId };
  } catch (error: any) {
    console.error('[QSTASH] Failed to queue assessment retry:', error.message);
    return { success: false, messageId: null, error: error.message };
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

// ============================================================
// WHATSAPP LEAD BOT
// ============================================================

interface WaLeadBotProcessData {
  conversationId: string;
  messageId: string;
  phone: string;
  text: string | null;
  type: string;
  contactName: string;
  interactiveId: string | null;
  interactiveTitle: string | null;
  currentState: string;
  requestId: string;
}

/**
 * Queue WhatsApp Lead Bot message for processing
 * Called by the webhook after saving the inbound message
 */
export async function queueWaLeadBotProcess(data: WaLeadBotProcessData): Promise<QueueResult> {
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping wa-leadbot process');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/whatsapp/process`,
      body: data,
      retries: 3,
      delay: 1, // 1 second delay
    });

    console.log('[QSTASH] Queued wa-leadbot process:', {
      messageId: response.messageId,
      conversationId: data.conversationId,
      state: data.currentState,
    });

    return { success: true, messageId: response.messageId };
  } catch (error: any) {
    console.error('[QSTASH] Failed to queue wa-leadbot process:', error.message);
    return { success: false, messageId: null, error: error.message };
  }
}

// ============================================================
// PROGRESS PULSE
// ============================================================

interface ProgressPulseJobData {
  enrollmentId: string;
  childId: string;
  childName: string;
  coachId: string;
  completedCount: number;
  pulseInterval: number;
  parentPhone?: string;
  parentEmail?: string;
  parentName?: string;
  requestId: string;
}

/**
 * Queue Progress Pulse generation job via QStash
 * Triggered after every N coaching sessions (N = age_band_config.progress_pulse_interval)
 */
export async function queueProgressPulse(data: ProgressPulseJobData): Promise<QueueResult> {
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping progress-pulse job');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/jobs/progress-pulse`,
      body: data,
      retries: 3,
      delay: 5, // 5 second delay to let session data settle
    });

    console.log('[QSTASH] Queued progress-pulse job:', {
      messageId: response.messageId,
      enrollmentId: data.enrollmentId,
      childName: data.childName,
      completedCount: data.completedCount,
      pulseInterval: data.pulseInterval,
    });

    return { success: true, messageId: response.messageId };
  } catch (error: any) {
    console.error('[QSTASH] Failed to queue progress-pulse:', error.message);
    return { success: false, messageId: null, error: error.message };
  }
}

// ============================================================
// GROUP CLASS PIPELINE JOBS
// ============================================================

interface GroupClassInsightsJobData {
  session_id: string;
  ratings: Array<{
    childId: string;
    childName: string;
    engagement: string;
    skillTags: string[];
    note?: string;
  }>;
  newly_earned_badges: Array<{ child_id: string; child_name: string; badge_name: string }>;
  class_type_name: string;
  session_date: string;
}

/**
 * Queue micro-insight generation for group class session
 * Runs immediately after session completion
 */
export async function queueGroupClassInsights(data: GroupClassInsightsJobData): Promise<QueueResult> {
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping group-class-insights job');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/cron/group-class-insights`,
      body: data,
      retries: 3,
      delay: 0,
    });

    console.log('[QSTASH] Queued group-class-insights job:', {
      messageId: response.messageId,
      sessionId: data.session_id,
      childCount: data.ratings.length,
    });

    return { success: true, messageId: response.messageId };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[QSTASH] Failed to queue group-class-insights:', msg);
    return { success: false, messageId: null, error: msg };
  }
}

/**
 * Queue parent notification delivery for group class session
 * Delayed 5 minutes to allow insights to generate first
 */
export async function queueGroupClassNotifications(data: { session_id: string }): Promise<QueueResult> {
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping group-class-notifications job');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/cron/group-class-notifications`,
      body: data,
      retries: 3,
      delay: 300, // 5 minutes
    });

    console.log('[QSTASH] Queued group-class-notifications job:', {
      messageId: response.messageId,
      sessionId: data.session_id,
      delay: '300s',
    });

    return { success: true, messageId: response.messageId };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[QSTASH] Failed to queue group-class-notifications:', msg);
    return { success: false, messageId: null, error: msg };
  }
}

/**
 * Queue parent feedback request for group class session
 * Delayed 2 hours to let the child tell parents about the class
 */
export async function queueGroupClassFeedbackRequest(data: { session_id: string }): Promise<QueueResult> {
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, skipping group-class-feedback-request job');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/cron/group-class-feedback-request`,
      body: data,
      retries: 3,
      delay: 7200, // 2 hours
    });

    console.log('[QSTASH] Queued group-class-feedback-request job:', {
      messageId: response.messageId,
      sessionId: data.session_id,
      delay: '7200s',
    });

    return { success: true, messageId: response.messageId };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[QSTASH] Failed to queue group-class-feedback-request:', msg);
    return { success: false, messageId: null, error: msg };
  }
}

// ============================================================
// AGENT NURTURE SCHEDULE
// ============================================================

/**
 * Setup agent nurture schedule (runs every 2 hours)
 * Enrolls silent leads into nurture sequences and sends timed messages
 *
 * Call this once during deployment or via admin endpoint
 */
export async function setupAgentNurtureSchedule(): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  return createQStashSchedule({
    scheduleId: 'agent-nurture-2h',
    url: `${APP_URL}/api/cron/agent-nurture`,
    cron: '0 */2 * * *', // Every 2 hours
  });
}

/**
 * Manually trigger agent nurture (for testing)
 */
export async function triggerAgentNurture(): Promise<QueueResult> {
  if (!qstash) {
    console.warn('[QSTASH] QStash not configured, cannot trigger agent nurture');
    return { success: false, messageId: null, error: 'QStash not configured' };
  }

  try {
    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/cron/agent-nurture`,
      body: { manual: true, timestamp: new Date().toISOString() },
      retries: 1,
    });

    console.log('[QSTASH] Triggered agent nurture:', {
      messageId: response.messageId,
    });

    return { success: true, messageId: response.messageId };
  } catch (error: any) {
    console.error('[QSTASH] Failed to trigger agent nurture:', error.message);
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