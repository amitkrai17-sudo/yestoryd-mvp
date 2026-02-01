// =============================================================================
// CRON: Coach Engagement Processor
// Runs on schedule (e.g., every 15 min) to send pending engagement messages
// Vercel Cron or QStash trigger
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { loadCoachConfig, loadIntegrationsConfig, loadEmailConfig } from '@/lib/config/loader';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
  const { data: pending, error } = await supabase
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
      await supabase.from('coach_engagement_log')
        .update({ status: 'skipped', skip_reason: 'Coach not found' })
        .eq('id', engagement.id);
      results.push({ id: engagement.id, status: 'skipped', reason: 'Coach not found' });
      continue;
    }

    // Check conditions
    if (engagement.condition === 'onboarding_incomplete' && coach.onboarding_complete) {
      await supabase.from('coach_engagement_log')
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
        await supabase.from('coach_engagement_log')
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

      await supabase.from('coach_engagement_log')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', engagement.id);
      results.push({ id: engagement.id, status: 'sent' });
    } catch (err: any) {
      await supabase.from('coach_engagement_log')
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

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: coach.email, name: coach.name }] }],
      from: { email: settings.adminEmail, name: 'Yestoryd Academy' },
      subject: subjects[template] || 'Yestoryd Academy Update',
      content: [{ type: 'text/html', value: bodies[template] || '<p>Update from Yestoryd Academy</p>' }],
    }),
  });

  if (!response.ok) {
    throw new Error(`SendGrid error: ${response.status}`);
  }
}

// =============================================================================
// WHATSAPP SENDER
// =============================================================================

async function sendEngagementWhatsApp(
  coach: { name: string; phone: string },
  template: string,
  settings: { siteBaseUrl: string }
) {
  if (!coach.phone || !process.env.AISENSY_API_KEY) {
    throw new Error('Missing phone or AiSensy API key');
  }

  const messages: Record<string, string> = {
    coach_approved_welcome: `🎉 Welcome to Yestoryd Academy, ${coach.name}!\n\nYou've been approved! Complete your onboarding here:\n👉 ${settings.siteBaseUrl}/coach/onboarding\n\nWe're excited to have you on board! 🌟`,
    coach_onboarding_reminder: `Hi ${coach.name} 👋\n\nReminder: Complete your onboarding to start receiving students!\n👉 ${settings.siteBaseUrl}/coach/onboarding\n\nNeed help? Just reply here!`,
    coach_week_checkin: `Hi ${coach.name} 🙏\n\nIt's been a week since your approval. How's everything going? Need any help with onboarding?\n\nJust reply here and we'll assist you!`,
    coach_profile_live: `🌟 ${coach.name}, your coach profile is live!\n\nYou'll be notified as soon as a student is assigned. Check your dashboard:\n👉 ${settings.siteBaseUrl}/coach/dashboard`,
    coach_preparing_student: `Hi ${coach.name} 👋\n\nWe're working on matching you with your first student. Hang tight!\n\nMeanwhile, explore your dashboard:\n👉 ${settings.siteBaseUrl}/coach/dashboard`,
    coach_status_update: `Hi ${coach.name}, quick update! We're actively matching students. You'll hear from us soon. 🙏`,
  };

  const message = messages[template];
  if (!message) throw new Error(`Unknown template: ${template}`);

  // Format phone
  let phone = coach.phone.replace(/\D/g, '');
  if (phone.length === 10) phone = '91' + phone;

  // Use AiSensy API
  const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: process.env.AISENSY_API_KEY,
      campaignName: template,
      destination: phone,
      userName: coach.name,
      templateParams: [coach.name],
      source: 'coach-engagement-cron',
      media: {},
      buttons: [],
      carouselCards: [],
      location: {},
    }),
  });

  if (!response.ok) {
    throw new Error(`AiSensy error: ${response.status}`);
  }
}
