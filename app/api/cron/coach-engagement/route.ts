// =============================================================================
// CRON: Coach Engagement Processor
// Runs on schedule (e.g., every 15 min) to send pending engagement messages
// Vercel Cron or QStash trigger
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { loadCoachConfig, loadIntegrationsConfig, loadEmailConfig } from '@/lib/config/loader';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronAuth = await verifyCronRequest(request);
  if (!cronAuth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const [coachConfig, integrationsConfig, emailConfig] = await Promise.all([
    loadCoachConfig(), loadIntegrationsConfig(), loadEmailConfig(),
  ]);
  const settings = {
    siteBaseUrl: integrationsConfig.siteBaseUrl,
    adminEmail: emailConfig.fromEmail,
  };
  const now = new Date().toISOString();

  // Get pending engagements that are due
  const { data: pending, error } = await (supabase as any)
    .from('coach_engagement_log')
    .select('*, coaches:coach_id(id, name, email, phone, onboarding_complete)')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(50);

  if (error || !pending) {
    console.error('[coach-engagement] Failed to fetch pending:', error);
    return NextResponse.json({ error: 'Failed to fetch pending engagements' }, { status: 500 });
  }

  const results: Array<{ id: string; status: string; reason?: string }> = [];

  for (const engagement of pending) {
    const coach = engagement.coaches as any;
    if (!coach) {
      await (supabase as any).from('coach_engagement_log')
        .update({ status: 'skipped', skip_reason: 'Coach not found' })
        .eq('id', engagement.id);
      results.push({ id: engagement.id, status: 'skipped', reason: 'Coach not found' });
      continue;
    }

    // Check conditions
    if (engagement.condition === 'onboarding_incomplete' && coach.onboarding_complete) {
      await (supabase as any).from('coach_engagement_log')
        .update({ status: 'skipped', skip_reason: 'Onboarding already complete' })
        .eq('id', engagement.id);
      results.push({ id: engagement.id, status: 'skipped', reason: 'Onboarding complete' });
      continue;
    }

    if (engagement.condition === 'no_assignment') {
      const { count } = await supabase
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', coach.id)
        .eq('status', 'active');

      if ((count || 0) > 0) {
        await (supabase as any).from('coach_engagement_log')
          .update({ status: 'skipped', skip_reason: 'Coach has active assignment' })
          .eq('id', engagement.id);
        results.push({ id: engagement.id, status: 'skipped', reason: 'Has assignment' });
        continue;
      }
    }

    // Send the message
    try {
      if (engagement.channel === 'email') {
        await sendEngagementEmail(coach, engagement.template, settings);
      } else if (engagement.channel === 'whatsapp') {
        await sendEngagementWhatsApp(coach, engagement.template, settings);
      }

      await (supabase as any).from('coach_engagement_log')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', engagement.id);
      results.push({ id: engagement.id, status: 'sent' });
    } catch (err: any) {
      await (supabase as any).from('coach_engagement_log')
        .update({ status: 'failed', skip_reason: err.message })
        .eq('id', engagement.id);
      results.push({ id: engagement.id, status: 'failed', reason: err.message });
    }
  }

  console.log(`[coach-engagement] Processed ${results.length} engagements`);
  return NextResponse.json({ processed: results.length, results });
}

// =============================================================================
// EMAIL SENDER
// =============================================================================

async function sendEngagementEmail(
  coach: { name: string; email: string },
  template: string,
  settings: { siteBaseUrl: string; adminEmail: string }
) {
  const subjects: Record<string, string> = {
    coach_approved_welcome: `Welcome to Yestoryd Academy, ${coach.name}!`,
    coach_onboarding_reminder: 'Complete Your Yestoryd Onboarding',
    coach_week_checkin: 'Quick Check-In - Yestoryd Academy',
    coach_profile_live: 'Your Coach Profile is Live!',
    coach_status_update: 'Your Yestoryd Academy Status Update',
  };

  const bodies: Record<string, string> = {
    coach_approved_welcome: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h1 style="color:#1e293b;">Welcome, ${coach.name}! 🎉</h1>
        <p>You've been approved to join the Yestoryd Academy coaching team.</p>
        <p>Complete your onboarding to start receiving student assignments:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${settings.siteBaseUrl}/coach/onboarding"
             style="display:inline-block;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Complete Onboarding →
          </a>
        </div>
        <p style="color:#64748b;">Warm regards,<br/><strong>Team Yestoryd</strong></p>
      </div>`,
    coach_onboarding_reminder: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#1e293b;">Hey ${coach.name} 👋</h2>
        <p>We noticed you haven't completed your onboarding yet. It only takes a few minutes!</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${settings.siteBaseUrl}/coach/onboarding"
             style="display:inline-block;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Finish Onboarding →
          </a>
        </div>
        <p style="color:#64748b;">Team Yestoryd</p>
      </div>`,
    coach_week_checkin: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#1e293b;">Hi ${coach.name} 🙏</h2>
        <p>It's been a week since your approval. Need any help with onboarding?</p>
        <p>Reply to this email or WhatsApp us — we're here to help!</p>
        <p style="color:#64748b;">Team Yestoryd</p>
      </div>`,
    coach_profile_live: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#1e293b;">Your profile is live! 🌟</h2>
        <p>${coach.name}, your coach profile is ready. You'll be notified as soon as a student is assigned.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${settings.siteBaseUrl}/coach/dashboard"
             style="display:inline-block;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">
            View Dashboard →
          </a>
        </div>
        <p style="color:#64748b;">Team Yestoryd</p>
      </div>`,
    coach_status_update: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#1e293b;">Status Update</h2>
        <p>Hi ${coach.name}, we're actively working on matching you with students. Hang tight!</p>
        <p style="color:#64748b;">Team Yestoryd</p>
      </div>`,
  };

  const { sendEmail } = require('@/lib/email/resend-client');

  const result = await sendEmail({
    to: coach.email,
    subject: subjects[template] || 'Yestoryd Academy Update',
    html: bodies[template] || '<p>Update from Yestoryd Academy</p>',
    from: { email: settings.adminEmail, name: 'Yestoryd Academy' },
  });

  if (!result.success) {
    throw new Error(`Email error: ${result.error}`);
  }
}

// =============================================================================
// WHATSAPP SENDER
// =============================================================================

async function sendEngagementWhatsApp(
  coach: { id?: string; name: string; phone: string },
  template: string,
  _settings: { siteBaseUrl: string }
) {
  if (!coach.phone || !process.env.AISENSY_API_KEY) {
    throw new Error('Missing phone or AiSensy API key');
  }

  const result = await sendWhatsAppMessage({
    to: coach.phone,
    templateName: template,
    variables: [coach.name],
    source: 'coach-engagement-cron',
    meta: {
      templateCode: template,
      recipientType: 'coach',
      recipientId: coach.id ?? null,
      triggeredBy: 'cron',
      contextType: 'coach_engagement',
      contextId: coach.id ?? null,
    },
  });

  if (!result.success) {
    throw new Error(`AiSensy error: ${result.error}`);
  }
}
