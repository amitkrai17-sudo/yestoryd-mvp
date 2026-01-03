// lib/qstash.ts
// QStash client for background job processing
// Yestoryd - AI-Powered Reading Intelligence Platform
// 
// CRITICAL: QStash enables async processing for 20K+ scale
// - Payment returns in < 2 seconds
// - Calendar/Email/WhatsApp processed in background
// - Auto-retry on failure (3x)
// - No timeout issues

import { Client } from '@upstash/qstash';

// Initialize QStash client
export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// Types for enrollment data
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
}

/**
 * Queue enrollment completion job via QStash
 * 
 * This is the ONLY way to process enrollments.
 * DO NOT add direct/synchronous fallback - it will break at scale!
 */
export async function queueEnrollmentComplete(data: EnrollmentJobData) {
  const appUrl = 'https://www.yestoryd.com';

  try {
    const response = await qstash.publishJSON({
      url: `${appUrl}/api/jobs/enrollment-complete`,
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

/**
 * Queue a delayed notification
 */
export async function queueDelayedNotification(data: {
  type: 'welcome_email' | 'session_reminder' | 'followup';
  payload: any;
  delaySeconds?: number;
}) {
  const appUrl = 'https://www.yestoryd.com';

  try {
    const response = await qstash.publishJSON({
      url: `${appUrl}/api/jobs/send-notification`,
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