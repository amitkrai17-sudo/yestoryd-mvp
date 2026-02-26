// ============================================================
// Lead Bot URL utility — single source of truth
// Fetches from site_settings with hardcoded fallbacks
// ============================================================

import { getSettings } from '@/lib/settings/getSettings';

const FALLBACKS = {
  assessment_url: 'https://www.yestoryd.com/assessment',
  booking_url: 'https://www.yestoryd.com/book-call',
};

export interface LeadBotUrls {
  assessmentUrl: string;
  bookingUrl: string;
}

export async function getLeadBotUrls(): Promise<LeadBotUrls> {
  const settings = await getSettings(['assessment_url', 'booking_url']);

  return {
    assessmentUrl: settings.assessment_url || FALLBACKS.assessment_url,
    bookingUrl: settings.booking_url || FALLBACKS.booking_url,
  };
}
