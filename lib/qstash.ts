// lib/qstash.ts
// Background job processing - Direct call (bypassing QStash for now)
// Yestoryd - AI-Powered Reading Intelligence Platform

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
 * TEMPORARILY calling directly instead of using QStash
 */
export async function queueEnrollmentComplete(data: EnrollmentJobData) {
  const appUrl = 'https://www.yestoryd.com';
  
  try {
    // Call job endpoint directly (bypass QStash temporarily)
    const response = await fetch(`${appUrl}/api/jobs/enrollment-complete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // Skip signature verification for direct calls
        'x-direct-call': 'true',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Job failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('📤 Job executed directly:', {
      enrollmentId: data.enrollmentId,
      childName: data.childName,
      sessionsScheduled: result.sessionsScheduled,
    });
    
    return {
      success: true,
      messageId: 'direct-' + Date.now(),
    };
  } catch (error: any) {
    console.error('❌ Failed to execute job:', error.message);
    throw error;
  }
}

/**
 * Queue a delayed follow-up email
 * TEMPORARILY disabled - will be re-enabled with QStash
 */
export async function queueDelayedEmail(data: {
  type: 'welcome' | 'reminder' | 'followup';
  recipientEmail: string;
  recipientName: string;
  childName?: string;
  delaySeconds?: number;
}) {
  console.log('⏸️ Delayed email queuing disabled (QStash bypass mode)');
  return { messageId: 'disabled' };
}

/**
 * Queue session reminder
 * TEMPORARILY disabled - will be re-enabled with QStash
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
  console.log('⏸️ Session reminder queuing disabled (QStash bypass mode)');
  return { messageId: 'disabled' };
}