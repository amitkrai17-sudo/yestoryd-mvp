// ============================================================
// FILE: lib/referral.ts
// ============================================================
// Referral code generation and tracking utilities
// Format: REF-{FIRSTNAME}-{4_RANDOM_CHARS}

import { SupabaseClient } from '@supabase/supabase-js';
// Generate 4 random alphanumeric characters
function generateRandomChars(length: number = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing: I,1,O,0
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Extract first name from full name
function extractFirstName(fullName: string): string {
  const firstName = fullName.trim().split(' ')[0];
  // Remove special characters and convert to uppercase
  return firstName.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 10);
}

/**
 * Generate a unique referral code for a coach
 * Format: REF-PRIYA-X7K9
 */
export function generateReferralCode(coachName: string): string {
  const firstName = extractFirstName(coachName);
  const randomPart = generateRandomChars(4);
  return `REF-${firstName}-${randomPart}`;
}

/**
 * Generate referral link
 */
export function generateReferralLink(referralCode: string, baseUrl: string = 'https://yestoryd.com'): string {
  return `${baseUrl}/assess?ref=${referralCode}`;
}

/**
 * Ensure coach has a referral code, generate if missing
 */
export async function ensureCoachReferralCode(
  supabase: SupabaseClient<any, any, any>,
  coachId: string,
  coachName: string
): Promise<{ referralCode: string; referralLink: string }> {
  // Check if coach already has a referral code
  const { data } = await supabase
    .from('coaches')
    .select('referral_code, referral_link')
    .eq('id', coachId)
    .single();

  const coach = data as { referral_code: string | null; referral_link: string | null } | null;

  if (coach?.referral_code) {
    return {
      referralCode: coach.referral_code,
      referralLink: coach.referral_link || generateReferralLink(coach.referral_code),
    };
  }

  // Generate new unique referral code
  let referralCode = generateReferralCode(coachName);
  let attempts = 0;
  const maxAttempts = 10;

  // Ensure uniqueness
  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('coaches')
      .select('id')
      .eq('referral_code', referralCode)
      .maybeSingle();

    if (!existing) break;

    // Code exists, generate a new one
    referralCode = generateReferralCode(coachName);
    attempts++;
  }

  const referralLink = generateReferralLink(referralCode);

  // Update coach with referral code - use any to bypass strict typing
  await (supabase as any)
    .from('coaches')
    .update({
      referral_code: referralCode,
      referral_link: referralLink,
      updated_at: new Date().toISOString(),
    })
    .eq('id', coachId);

  return { referralCode, referralLink };
}

/**
 * Look up coach by referral code
 */
export async function getCoachByReferralCode(
  supabase: SupabaseClient<any, any, any>,
  referralCode: string
): Promise<{ id: string; name: string; email: string } | null> {
  const { data } = await supabase
    .from('coaches')
    .select('id, name, email')
    .eq('referral_code', referralCode.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();

  return data as { id: string; name: string; email: string } | null;
}

/**
 * Track a referral visit
 */
export async function trackReferralVisit(
  supabase: SupabaseClient<any, any, any>,
  referralCode: string,
  visitorData?: {
    ip_address?: string;
    user_agent?: string;
    landing_page?: string;
  }
): Promise<void> {
  try {
    const coach = await getCoachByReferralCode(supabase, referralCode);
    
    if (!coach) return;

    await (supabase as any).from('referral_visits').insert({
      coach_id: coach.id,
      referral_code: referralCode,
      ip_address: visitorData?.ip_address,
      user_agent: visitorData?.user_agent,
      landing_page: visitorData?.landing_page,
      visited_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to track referral visit:', error);
  }
}