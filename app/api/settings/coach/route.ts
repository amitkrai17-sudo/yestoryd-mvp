// Public API to expose non-sensitive coach settings to client components
import { NextResponse } from 'next/server';
import { loadCoachConfig, loadIntegrationsConfig, loadEmailConfig } from '@/lib/config/loader';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [coachConfig, integrationsConfig, emailConfig] = await Promise.all([
      loadCoachConfig(),
      loadIntegrationsConfig(),
      loadEmailConfig(),
    ]);
    return NextResponse.json({
      whatsappNumber: '', // Not exposed publicly
      earningsYestorydLead: coachConfig.earningsYestorydLead,
      earningsCoachLead: coachConfig.earningsCoachLead,
      adminEmail: emailConfig.fromEmail,
      ruchaEmail: coachConfig.defaultCoachEmail,
      interviewDurationMinutes: coachConfig.interviewDurationMinutes,
      assessmentPassScore: coachConfig.assessmentPassScore,
      siteBaseUrl: integrationsConfig.siteBaseUrl,
      fromEmail: coachConfig.fromEmail,
      referralBonus: coachConfig.referralBonus,
    });
  } catch (error) {
    console.error('Error fetching coach settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
