// ============================================================
// FILE: lib/group-classes/waitlist-promotion.ts
// ============================================================
// Auto-promote the next waitlisted person when a spot opens.
// Called from: cancel participant API, admin remove participant.
//
// Flow:
//   1. Find first 'waiting' entry by position
//   2. Mark as 'notified', set notification_expires_at (24h)
//   3. Send WhatsApp + email + in-app notification
//   4. If not claimed in 24h, cron can expire and promote next
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import { sendEmail } from '@/lib/email/resend-client';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

const getSupabase = createAdminClient;

interface PromotionResult {
  promoted: boolean;
  waitlist_id?: string;
  child_id?: string;
  parent_id?: string;
  error?: string;
}

/**
 * Promote the next person on the waitlist for a session.
 * Returns info about who was promoted, or { promoted: false } if none.
 */
export async function promoteNextWaitlisted(
  sessionId: string,
  className: string,
  sessionDate: string,
  sessionTime: string,
): Promise<PromotionResult> {
  const supabase = getSupabase();

  // Find next waiting entry (lowest position)
  const { data: nextEntry } = await supabase
    .from('group_class_waitlist')
    .select('id, child_id, parent_id, position')
    .eq('group_session_id', sessionId)
    .eq('status', 'waiting')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextEntry) {
    return { promoted: false };
  }

  // Set notification expiry (24 hours from now)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: updateErr } = await supabase
    .from('group_class_waitlist')
    .update({
      status: 'notified',
      notified_at: new Date().toISOString(),
      notification_expires_at: expiresAt,
    })
    .eq('id', nextEntry.id);

  if (updateErr) {
    return { promoted: false, error: updateErr.message };
  }

  // Fetch parent + child details for notification
  const [{ data: parent }, { data: child }] = await Promise.all([
    supabase.from('parents').select('id, name, email, phone').eq('id', nextEntry.parent_id!).single(),
    supabase.from('children').select('id, child_name').eq('id', nextEntry.child_id).single(),
  ]);

  const parentName = parent?.name || 'Parent';
  const childName = child?.child_name || 'your child';

  // ── Notifications ──

  // WhatsApp
  if (parent?.phone) {
    try {
      await sendWhatsAppMessage({
        to: parent.phone,
        templateName: 'group_class_waitlist_spot_open',
        variables: [parentName, childName, className, sessionDate, '24'],
      });
    } catch (err) {
      console.error('[waitlist-promotion] WhatsApp failed:', err instanceof Error ? err.message : err);
    }
  }

  // Email
  if (parent?.email) {
    try {
      await sendEmail({
        to: parent.email,
        subject: `A spot opened in ${className} for ${childName}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #FF0099;">A Spot Just Opened!</h2>
            <p>Hi ${parentName},</p>
            <p>Great news! A spot has opened up in <strong>${className}</strong> scheduled for <strong>${sessionDate}</strong> at <strong>${sessionTime}</strong>.</p>
            <p>${childName} was next on the waitlist. You have <strong>24 hours</strong> to claim this spot before it's offered to the next person.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com'}/group-classes"
                 style="display: inline-block; background: #FF0099; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Register Now
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">This spot will be available for 24 hours from this notification.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('[waitlist-promotion] Email failed:', err instanceof Error ? err.message : err);
    }
  }

  // In-app notification
  if (nextEntry.parent_id) {
    try {
      await supabase.from('in_app_notifications').insert({
        user_id: nextEntry.parent_id,
        user_type: 'parent',
        title: `Spot open in ${className}!`,
        body: `A spot opened for ${childName}. Register within 24 hours to claim it.`,
        notification_type: 'success',
        action_url: '/group-classes',
        metadata: {
          session_id: sessionId,
          child_id: nextEntry.child_id,
          type: 'waitlist_spot_open',
          expires_at: expiresAt,
        },
      });
    } catch {
      // Non-critical
    }
  }

  // Activity log
  try {
    await supabase.from('activity_log').insert({
      user_email: COMPANY_CONFIG.supportEmail,
      user_type: 'system',
      action: 'group_class_waitlist_promoted',
      metadata: {
        session_id: sessionId,
        waitlist_id: nextEntry.id,
        child_id: nextEntry.child_id,
        parent_id: nextEntry.parent_id,
        position: nextEntry.position,
        class_name: className,
        notification_expires_at: expiresAt,
      },
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-critical
  }

  return {
    promoted: true,
    waitlist_id: nextEntry.id,
    child_id: nextEntry.child_id,
    parent_id: nextEntry.parent_id || undefined,
  };
}
