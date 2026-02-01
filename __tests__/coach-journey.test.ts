// ============================================================================
// COACH JOURNEY UNIT TESTS
// __tests__/coach-journey.test.ts
// Tests: rate limiter, coach settings, auth guards
// ============================================================================

import { checkRateLimit } from '@/lib/utils/rate-limiter';

describe('Rate Limiter', () => {
  it('should allow requests within limit', () => {
    const result = checkRateLimit('test-allow-1', { maxRequests: 5, windowMs: 60000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should block requests exceeding limit', () => {
    const key = 'test-block-' + Date.now();
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { maxRequests: 3, windowMs: 60000 });
    }
    const result = checkRateLimit(key, { maxRequests: 3, windowMs: 60000 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should track remaining correctly', () => {
    const key = 'test-remaining-' + Date.now();
    const r1 = checkRateLimit(key, { maxRequests: 5, windowMs: 60000 });
    expect(r1.remaining).toBe(4);
    const r2 = checkRateLimit(key, { maxRequests: 5, windowMs: 60000 });
    expect(r2.remaining).toBe(3);
    const r3 = checkRateLimit(key, { maxRequests: 5, windowMs: 60000 });
    expect(r3.remaining).toBe(2);
  });

  it('should use different counters for different keys', () => {
    const key1 = 'test-key1-' + Date.now();
    const key2 = 'test-key2-' + Date.now();
    // Exhaust key1
    for (let i = 0; i < 2; i++) {
      checkRateLimit(key1, { maxRequests: 2, windowMs: 60000 });
    }
    const blocked = checkRateLimit(key1, { maxRequests: 2, windowMs: 60000 });
    expect(blocked.success).toBe(false);
    // key2 should still work
    const allowed = checkRateLimit(key2, { maxRequests: 2, windowMs: 60000 });
    expect(allowed.success).toBe(true);
  });

  it('should return resetIn in seconds', () => {
    const key = 'test-reset-' + Date.now();
    const result = checkRateLimit(key, { maxRequests: 10, windowMs: 30000 });
    expect(result.resetIn).toBe(30);
  });
});

// Coach settings tests with mocked getSettings
jest.mock('@/lib/settings/getSettings', () => ({
  getSettings: jest.fn().mockResolvedValue({
    coach_whatsapp_number: '919999999999',
    coach_earnings_yestoryd_lead: '3000',
    coach_earnings_coach_lead: '4000',
    coach_admin_email: 'test@yestoryd.com',
    coach_rucha_email: 'rucha@test.com',
    coach_interview_duration_minutes: '25',
    coach_assessment_pass_score: '7',
    site_base_url: 'https://test.yestoryd.com',
    coach_from_email: 'Test <test@yestoryd.com>',
    coach_referral_bonus: '600',
  }),
}));

import { loadCoachConfig } from '@/lib/config/loader';

describe('Coach Settings', () => {
  it('should fetch and parse settings from DB', async () => {
    const settings = await getCoachSettings();
    expect(settings.whatsappNumber).toBe('919999999999');
    expect(settings.earningsYestorydLead).toBe(3000);
    expect(settings.earningsCoachLead).toBe(4000);
    expect(settings.adminEmail).toBe('test@yestoryd.com');
    expect(settings.ruchaEmail).toBe('rucha@test.com');
    expect(settings.interviewDurationMinutes).toBe(25);
    expect(settings.assessmentPassScore).toBe(7);
    expect(settings.siteBaseUrl).toBe('https://test.yestoryd.com');
    expect(settings.fromEmail).toBe('Test <test@yestoryd.com>');
    expect(settings.referralBonus).toBe(600);
  });

  it('should return cached settings on subsequent calls', async () => {
    const { getSettings } = require('@/lib/settings/getSettings');
    (getSettings as jest.Mock).mockClear();

    await getCoachSettings();
    await getCoachSettings();

    // Should only have called getSettings once due to cache
    // (first call was in previous test, cached for 5 min)
    expect(getSettings).not.toHaveBeenCalled();
  });
});
