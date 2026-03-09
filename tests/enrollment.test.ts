// =============================================================================
// ENROLLMENT & AGE BAND TESTS
// tests/enrollment.test.ts
//
// Tests session count / duration logic from pricing-config.ts + v2-schema.ts,
// and enrollment-complete route behaviour (via import of helpers).
// No DB, no HTTP, no external services.
// =============================================================================

// --- Mock ALL external modules before any imports ---
vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/index', () => ({
  createClient: vi.fn(),
  createBrowserClient: vi.fn(),
}));
vi.mock('@/lib/api-auth', () => ({
  getServiceSupabase: vi.fn(),
}));
vi.mock('@/lib/recall-auto-bot', () => ({
  scheduleBotsForEnrollment: vi.fn(),
}));
vi.mock('googleapis', () => ({
  google: {
    auth: { JWT: vi.fn() },
    calendar: vi.fn(),
  },
}));
vi.mock('@upstash/qstash', () => ({
  Receiver: vi.fn(),
}));
vi.mock('@/lib/email/resend-client', () => ({
  sendEmail: vi.fn(),
}));
vi.mock('@/lib/config/company-config', () => ({
  COMPANY_CONFIG: {
    supportEmail: 'test@yestoryd.com',
    leadBotWhatsApp: '918591287997',
    leadBotWhatsAppDisplay: '+91 85912 87997',
    aiSensyWhatsApp: '918976287997',
  },
}));

import {
  getSessionCount,
  getSessionDuration,
  getBoosterCredits,
  getSessionCountForChild,
  getSessionDurationForChild,
  getSessionRangeForTier,
  getDurationRange,
  getPerWeekPrice,
  getGenericSessionRange,
  formatPricingSummary,
  type PricingConfig,
  type AgeBandConfig,
  type PricingTier,
} from '@/lib/config/pricing-config';

import {
  getSessionsForTier,
  getBoosterCreditsForTier,
} from '@/types/v2-schema';

// =============================================================================
// FIXTURES — matches FALLBACK values in pricing-config.ts
// =============================================================================

const FOUNDATION: AgeBandConfig = {
  id: 'foundation',
  displayName: 'Foundation',
  ageMin: 4,
  ageMax: 6,
  sessionDurationMinutes: 30,
  sessionsPerWeek: 2,
  weeklyPattern: [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
  sessionsPerSeason: 18,
  skillBoosterCredits: 6,
  seasonDurationWeeks: 12,
};

const BUILDING: AgeBandConfig = {
  id: 'building',
  displayName: 'Building',
  ageMin: 7,
  ageMax: 9,
  sessionDurationMinutes: 45,
  sessionsPerWeek: 1,
  weeklyPattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  sessionsPerSeason: 12,
  skillBoosterCredits: 4,
  seasonDurationWeeks: 12,
};

const MASTERY: AgeBandConfig = {
  id: 'mastery',
  displayName: 'Mastery',
  ageMin: 10,
  ageMax: 12,
  sessionDurationMinutes: 60,
  sessionsPerWeek: 1,
  weeklyPattern: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
  sessionsPerSeason: 9,
  skillBoosterCredits: 3,
  seasonDurationWeeks: 12,
};

const STARTER: PricingTier = {
  slug: 'starter',
  name: 'Starter',
  durationWeeks: 4,
  startWeek: 0,
  originalPrice: 4999,
  discountedPrice: 3999,
  currency: 'INR',
  isFeatured: false,
  displayOrder: 1,
};

const CONTINUATION: PricingTier = {
  slug: 'continuation',
  name: 'Continuation',
  durationWeeks: 8,
  startWeek: 4,
  originalPrice: 8999,
  discountedPrice: 7499,
  currency: 'INR',
  isFeatured: true,
  displayOrder: 2,
};

const FULL: PricingTier = {
  slug: 'full',
  name: 'Full Program',
  durationWeeks: 12,
  startWeek: 0,
  originalPrice: 11999,
  discountedPrice: 6999,
  currency: 'INR',
  isFeatured: false,
  displayOrder: 3,
};

function makeConfig(): PricingConfig {
  return {
    ageBands: [FOUNDATION, BUILDING, MASTERY],
    tiers: [STARTER, CONTINUATION, FULL],
    fetchedAt: Date.now(),
  };
}

// =============================================================================
// 1. SESSION COUNTS PER AGE BAND (Full Program = 12 weeks)
// =============================================================================

describe('session counts per age band (full program)', () => {
  const config = makeConfig();

  it('Foundation: 18 coaching sessions over 12 weeks', () => {
    const count = getSessionCount(config, 'foundation', 'full');
    expect(count).toBe(18);
  });

  it('Building: 12 coaching sessions over 12 weeks', () => {
    const count = getSessionCount(config, 'building', 'full');
    expect(count).toBe(12);
  });

  it('Mastery: 9 coaching sessions over 12 weeks', () => {
    const count = getSessionCount(config, 'mastery', 'full');
    expect(count).toBe(9);
  });
});

describe('session durations per age band', () => {
  const config = makeConfig();

  it('Foundation: 30 min sessions', () => {
    expect(getSessionDuration(config, 'foundation')).toBe(30);
  });

  it('Building: 45 min sessions', () => {
    expect(getSessionDuration(config, 'building')).toBe(45);
  });

  it('Mastery: 60 min sessions', () => {
    expect(getSessionDuration(config, 'mastery')).toBe(60);
  });
});

// =============================================================================
// 2. getSessionsForTier — low-level weeklyPattern slicing
// =============================================================================

describe('getSessionsForTier (weeklyPattern slicing)', () => {
  it('Foundation starter (weeks 0-3): 2+1+2+1 = 6', () => {
    expect(getSessionsForTier(FOUNDATION.weeklyPattern, 4, 0)).toBe(6);
  });

  it('Foundation continuation (weeks 4-11): 2+1+2+1+2+1+2+1 = 12', () => {
    expect(getSessionsForTier(FOUNDATION.weeklyPattern, 8, 4)).toBe(12);
  });

  it('Foundation full (weeks 0-11): all 18', () => {
    expect(getSessionsForTier(FOUNDATION.weeklyPattern, 12, 0)).toBe(18);
  });

  it('Building starter (weeks 0-3): 1+1+1+1 = 4', () => {
    expect(getSessionsForTier(BUILDING.weeklyPattern, 4, 0)).toBe(4);
  });

  it('Building continuation (weeks 4-11): 1*8 = 8', () => {
    expect(getSessionsForTier(BUILDING.weeklyPattern, 8, 4)).toBe(8);
  });

  it('Mastery starter (weeks 0-3): 1+1+1+0 = 3', () => {
    expect(getSessionsForTier(MASTERY.weeklyPattern, 4, 0)).toBe(3);
  });

  it('Mastery continuation (weeks 4-11): 1+1+1+0+1+1+1+0 = 6', () => {
    expect(getSessionsForTier(MASTERY.weeklyPattern, 8, 4)).toBe(6);
  });

  it('Mastery full (weeks 0-11): 9', () => {
    expect(getSessionsForTier(MASTERY.weeklyPattern, 12, 0)).toBe(9);
  });

  it('returns 0 for empty pattern', () => {
    expect(getSessionsForTier([], 12, 0)).toBe(0);
  });

  it('returns 0 when startWeek exceeds pattern length', () => {
    expect(getSessionsForTier([1, 1], 4, 10)).toBe(0);
  });
});

// =============================================================================
// 3. SKILL BOOSTER CREDITS
// =============================================================================

describe('skill booster credits per tier', () => {
  const config = makeConfig();

  it('Foundation full: 6 credits', () => {
    expect(getBoosterCredits(config, 'foundation', 'full')).toBe(6);
  });

  it('Foundation starter (4/12 weeks): round(6/12*4) = 2', () => {
    expect(getBoosterCredits(config, 'foundation', 'starter')).toBe(2);
  });

  it('Foundation continuation (8/12 weeks): round(6/12*8) = 4', () => {
    expect(getBoosterCredits(config, 'foundation', 'continuation')).toBe(4);
  });

  it('Building full: 4 credits', () => {
    expect(getBoosterCredits(config, 'building', 'full')).toBe(4);
  });

  it('Mastery full: 3 credits', () => {
    expect(getBoosterCredits(config, 'mastery', 'full')).toBe(3);
  });
});

describe('getBoosterCreditsForTier (low-level)', () => {
  it('proportional: round(6/12*4) = 2', () => {
    expect(getBoosterCreditsForTier(6, 4, 12)).toBe(2);
  });

  it('proportional: round(4/12*8) = 3', () => {
    expect(getBoosterCreditsForTier(4, 8, 12)).toBe(3);
  });

  it('full season returns total credits', () => {
    expect(getBoosterCreditsForTier(6, 12, 12)).toBe(6);
  });

  it('0 credits returns 0', () => {
    expect(getBoosterCreditsForTier(0, 12, 12)).toBe(0);
  });
});

// =============================================================================
// 4. SESSION COUNT BY CHILD AGE (uses age band resolution)
// =============================================================================

describe('getSessionCountForChild', () => {
  const config = makeConfig();

  it('4-year-old gets Foundation full = 18', () => {
    expect(getSessionCountForChild(config, 4, 'full')).toBe(18);
  });

  it('6-year-old gets Foundation full = 18', () => {
    expect(getSessionCountForChild(config, 6, 'full')).toBe(18);
  });

  it('7-year-old gets Building full = 12', () => {
    expect(getSessionCountForChild(config, 7, 'full')).toBe(12);
  });

  it('9-year-old gets Building full = 12', () => {
    expect(getSessionCountForChild(config, 9, 'full')).toBe(12);
  });

  it('10-year-old gets Mastery full = 9', () => {
    expect(getSessionCountForChild(config, 10, 'full')).toBe(9);
  });

  it('12-year-old gets Mastery full = 9', () => {
    expect(getSessionCountForChild(config, 12, 'full')).toBe(9);
  });

  it('3-year-old (below range) returns 0', () => {
    expect(getSessionCountForChild(config, 3, 'full')).toBe(0);
  });

  it('13-year-old (above range) returns 0', () => {
    expect(getSessionCountForChild(config, 13, 'full')).toBe(0);
  });
});

describe('getSessionDurationForChild', () => {
  const config = makeConfig();

  it('5-year-old gets 30 min', () => {
    expect(getSessionDurationForChild(config, 5)).toBe(30);
  });

  it('8-year-old gets 45 min', () => {
    expect(getSessionDurationForChild(config, 8)).toBe(45);
  });

  it('11-year-old gets 60 min', () => {
    expect(getSessionDurationForChild(config, 11)).toBe(60);
  });

  it('out-of-range age falls back to 45 min', () => {
    expect(getSessionDurationForChild(config, 2)).toBe(45);
  });
});

// =============================================================================
// 5. EDGE CASES — invalid inputs, missing bands, empty config
// =============================================================================

describe('edge cases', () => {
  const config = makeConfig();

  it('getSessionCount returns 0 for unknown age band', () => {
    expect(getSessionCount(config, 'nonexistent', 'full')).toBe(0);
  });

  it('getSessionCount returns 0 for unknown tier', () => {
    expect(getSessionCount(config, 'foundation', 'nonexistent')).toBe(0);
  });

  it('getSessionDuration falls back to 45 for unknown band', () => {
    expect(getSessionDuration(config, 'nonexistent')).toBe(45);
  });

  it('getBoosterCredits returns 0 for unknown band', () => {
    expect(getBoosterCredits(config, 'nonexistent', 'full')).toBe(0);
  });

  it('getBoosterCredits returns 0 for unknown tier', () => {
    expect(getBoosterCredits(config, 'foundation', 'nonexistent')).toBe(0);
  });

  it('empty ageBands config returns 0 sessions', () => {
    const empty: PricingConfig = { ageBands: [], tiers: [FULL], fetchedAt: Date.now() };
    expect(getSessionCount(empty, 'foundation', 'full')).toBe(0);
  });

  it('empty tiers config returns 0 sessions', () => {
    const empty: PricingConfig = { ageBands: [FOUNDATION], tiers: [], fetchedAt: Date.now() };
    expect(getSessionCount(empty, 'foundation', 'full')).toBe(0);
  });

  it('age band with empty weeklyPattern returns 0 sessions', () => {
    const emptyPattern: AgeBandConfig = { ...FOUNDATION, weeklyPattern: [] };
    const cfg: PricingConfig = { ageBands: [emptyPattern], tiers: [FULL], fetchedAt: Date.now() };
    expect(getSessionCount(cfg, 'foundation', 'full')).toBe(0);
  });
});

// =============================================================================
// 6. GENERIC HELPER FUNCTIONS
// =============================================================================

describe('getSessionRangeForTier', () => {
  const config = makeConfig();

  it('full tier: min=9 (Mastery), max=18 (Foundation)', () => {
    const range = getSessionRangeForTier(config, 'full');
    expect(range.min).toBe(9);
    expect(range.max).toBe(18);
  });

  it('starter tier: min=3 (Mastery), max=6 (Foundation)', () => {
    const range = getSessionRangeForTier(config, 'starter');
    expect(range.min).toBe(3);
    expect(range.max).toBe(6);
  });

  it('unknown tier: min=0, max=0', () => {
    const range = getSessionRangeForTier(config, 'nonexistent');
    expect(range.min).toBe(0);
    expect(range.max).toBe(0);
  });
});

describe('getDurationRange', () => {
  const config = makeConfig();

  it('returns min=30, max=60 across all age bands', () => {
    const range = getDurationRange(config);
    expect(range.min).toBe(30);
    expect(range.max).toBe(60);
  });

  it('empty ageBands falls back to min=30, max=60', () => {
    const empty: PricingConfig = { ageBands: [], tiers: [], fetchedAt: Date.now() };
    const range = getDurationRange(empty);
    expect(range.min).toBe(30);
    expect(range.max).toBe(60);
  });
});

describe('getPerWeekPrice', () => {
  const config = makeConfig();

  it('returns cheapest per-week price', () => {
    // Starter: 3999/4 = 1000, Continuation: 7499/8 = 937, Full: 6999/12 = 583
    expect(getPerWeekPrice(config)).toBe(583);
  });

  it('empty tiers falls back to 375', () => {
    const empty: PricingConfig = { ageBands: [], tiers: [], fetchedAt: Date.now() };
    expect(getPerWeekPrice(empty)).toBe(375);
  });
});

describe('getGenericSessionRange', () => {
  const config = makeConfig();

  it('Foundation: 6-18 across all tiers', () => {
    expect(getGenericSessionRange(config, 'foundation')).toBe('6\u201318');
  });

  it('Building: 4-12 across all tiers', () => {
    expect(getGenericSessionRange(config, 'building')).toBe('4\u201312');
  });

  it('unknown band: returns 0', () => {
    expect(getGenericSessionRange(config, 'nonexistent')).toBe('0');
  });
});

describe('formatPricingSummary', () => {
  const config = makeConfig();

  it('formats Foundation full correctly', () => {
    const summary = formatPricingSummary(config, 'foundation', 'full');
    expect(summary).toContain('6,999');
    expect(summary).toContain('12 weeks');
    expect(summary).toContain('18 sessions');
  });

  it('formats Building starter correctly', () => {
    const summary = formatPricingSummary(config, 'building', 'starter');
    expect(summary).toContain('3,999');
    expect(summary).toContain('4 weeks');
    expect(summary).toContain('4 sessions');
  });

  it('returns empty string for unknown tier', () => {
    expect(formatPricingSummary(config, 'foundation', 'nonexistent')).toBe('');
  });
});

// =============================================================================
// 7. STARTER + CONTINUATION SESSION SPLIT CONSISTENCY
//    Starter (weeks 0-3) + Continuation (weeks 4-11) = Full (weeks 0-11)
// =============================================================================

describe('starter + continuation = full program', () => {
  const config = makeConfig();

  it('Foundation: 6 + 12 = 18', () => {
    const starter = getSessionCount(config, 'foundation', 'starter');
    const continuation = getSessionCount(config, 'foundation', 'continuation');
    const full = getSessionCount(config, 'foundation', 'full');
    expect(starter + continuation).toBe(full);
  });

  it('Building: 4 + 8 = 12', () => {
    const starter = getSessionCount(config, 'building', 'starter');
    const continuation = getSessionCount(config, 'building', 'continuation');
    const full = getSessionCount(config, 'building', 'full');
    expect(starter + continuation).toBe(full);
  });

  it('Mastery: 3 + 6 = 9', () => {
    const starter = getSessionCount(config, 'mastery', 'starter');
    const continuation = getSessionCount(config, 'mastery', 'continuation');
    const full = getSessionCount(config, 'mastery', 'full');
    expect(starter + continuation).toBe(full);
  });
});

// =============================================================================
// 8. TOTAL COACHING HOURS CONSISTENCY
//    All bands = 9 coaching hrs per full season
// =============================================================================

describe('total coaching hours per season (all bands = 9 hrs)', () => {
  const config = makeConfig();

  it('Foundation: 18 sessions x 30 min = 540 min = 9 hrs', () => {
    const sessions = getSessionCount(config, 'foundation', 'full');
    const duration = getSessionDuration(config, 'foundation');
    expect(sessions * duration).toBe(540); // 9 hrs
  });

  it('Building: 12 sessions x 45 min = 540 min = 9 hrs', () => {
    const sessions = getSessionCount(config, 'building', 'full');
    const duration = getSessionDuration(config, 'building');
    expect(sessions * duration).toBe(540); // 9 hrs
  });

  it('Mastery: 9 sessions x 60 min = 540 min = 9 hrs', () => {
    const sessions = getSessionCount(config, 'mastery', 'full');
    const duration = getSessionDuration(config, 'mastery');
    expect(sessions * duration).toBe(540); // 9 hrs
  });
});

// =============================================================================
// 9. AGE BOUNDARY TESTS — correct band resolution at edges
// =============================================================================

describe('age boundary resolution', () => {
  const config = makeConfig();

  it('age 6 resolves to Foundation (not Building)', () => {
    expect(getSessionDurationForChild(config, 6)).toBe(30); // Foundation
  });

  it('age 7 resolves to Building (not Foundation)', () => {
    expect(getSessionDurationForChild(config, 7)).toBe(45); // Building
  });

  it('age 9 resolves to Building (not Mastery)', () => {
    expect(getSessionDurationForChild(config, 9)).toBe(45); // Building
  });

  it('age 10 resolves to Mastery (not Building)', () => {
    expect(getSessionDurationForChild(config, 10)).toBe(60); // Mastery
  });
});
