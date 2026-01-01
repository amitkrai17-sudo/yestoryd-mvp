// lib/qstash.ts
// QStash client for background job processing
// Yestoryd - AI-Powered Reading Intelligence Platform

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
 * Queue enrollment completion job
 * This handles:
 * - Scheduling 9 Google Calendar sessions
 * - Sending confirmation email
 * - Updating enrollment status
 * 
 * Runs asynchronously with automatic retries
 */
export async function queueEnrollmentComplete(data: EnrollmentJobData) {
  const appUrl = 'https://yestoryd.com';
  
  try {
    const response = await qstash.publishJSON({
      url: `${appUrl}/api/jobs/enrollment-complete`,
      body: data,
      retries: 3,           // Retry up to 3 times if it fails
      delay: 0,             // Start immediately
      // Optional: Add a callback URL for job completion notification
      // callback: `${appUrl}/api/jobs/callback`,
    });

    console.log('📤 Queued enrollment-complete job:', {
      messageId: response.messageId,
      enrollmentId: data.enrollmentId,
      childName: data.childName,
    });
    
    return {
      success: true,
      messageId: response.messageId,
    };
  } catch (error: any) {
    console.error('❌ Failed to queue job:', error.message);
    throw error;
  }
}

/**
 * Queue a delayed follow-up email
 * Useful for sending reminders or nurture sequences
 */
export async function queueDelayedEmail(data: {
  type: 'welcome' | 'reminder' | 'followup';
  recipientEmail: string;
  recipientName: string;
  childName?: string;
  delaySeconds?: number;
}) {
  const appUrl = 'https://yestoryd.com';
  
  const response = await qstash.publishJSON({
    url: `${appUrl}/api/jobs/send-email`,
    body: data,
    delay: data.delaySeconds || 0,
    retries: 2,
  });

  console.log('📤 Queued email job:', {
    messageId: response.messageId,
    type: data.type,
    delay: data.delaySeconds ? `${data.delaySeconds}s` : 'immediate',
  });
  
  return response;
}

/**
 * Queue session reminder
 * Send 24 hours before scheduled session
 */
export async function queueSessionReminder(data: {
  sessionId: string;
  parentEmail: string;
  parentName: string;
  childName: string;
  coachName: string;
  sessionDate: string;
  meetLink: string;
}) {
  const appUrl = 'https://yestoryd.com';
  
  // Calculate delay to send 24 hours before session
  const sessionTime = new Date(data.sessionDate).getTime();
  const reminderTime = sessionTime - (24 * 60 * 60 * 1000); // 24 hours before
  const now = Date.now();
  const delayMs = Math.max(0, reminderTime - now);
  const delaySeconds = Math.floor(delayMs / 1000);

  if (delaySeconds <= 0) {
    console.log('⚠️ Session too soon for reminder, skipping');
    return null;
  }

  const response = await qstash.publishJSON({
    url: `${appUrl}/api/jobs/session-reminder`,
    body: data,
    delay: delaySeconds,
    retries: 2,
  });

  console.log('📤 Queued session reminder:', {
    messageId: response.messageId,
    sessionId: data.sessionId,
    scheduledFor: new Date(reminderTime).toISOString(),
  });
  
  return response;
}

