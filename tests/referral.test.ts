// =============================================================================
// REFERRAL REGISTRATION TESTS
// tests/referral.test.ts
//
// Tests referral registration logic, referrer type detection, reward info,
// code generation, validation, and lead cost percentage by referrer type.
// No real DB or HTTP calls — all Supabase interactions are mocked.
// =============================================================================

// --- Mock ALL external modules before any imports ---
// NOTE: vi.mock factories are hoisted — cannot reference top-level variables.
// Use vi.hoisted() to define shared mock references.

const { mockFrom, mockLoadPayoutConfig } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockLoadPayoutConfig: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockFrom },
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/index', () => ({
  createClient: vi.fn(),
  createBrowserClient: vi.fn(),
}));
vi.mock('@/lib/utils/phone', () => ({
  normalizePhone: (phone: string) => `+91${phone}`,
  formatForWhatsApp: (phone: string) => `91${phone}`,
}));

vi.mock('@/lib/config/payout-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config/payout-config')>();
  return {
    ...actual,
    loadPayoutConfig: mockLoadPayoutConfig,
  };
});

import {
  generateReferralCode,
  calculateLeadCost,
  type PayoutConfig,
  type ReferrerType,
} from '@/lib/config/payout-config';

// =============================================================================
// FIXTURES
// =============================================================================

function makeConfig(overrides: Partial<PayoutConfig> = {}): PayoutConfig {
  return {
    payout_model: 'per_session',
    payout_day_of_month: 7,
    skill_building_rate_multiplier: 0.5,
    skill_building_counts_toward_tier: true,
    tds_rate_percent: 10,
    tds_threshold_annual: 30000,
    coach_max_children: 20,
    reenrollment_coach_bonus: 500,
    reenrollment_coach_bonus_enabled: true,
    lead_cost_referrer_percent_coach: 10,
    lead_cost_referrer_percent_parent: 10,
    lead_cost_referrer_percent_external: 5,
    lead_cost_referrer_percent_influencer: 10,
    coaching_bonus_percent: 0,
    coaching_bonus_on_organic: true,
    coaching_bonus_timing: 'after_first_session',
    lead_cost_decay_continuation: 0.5,
    lead_cost_decay_reenrollment: 0,
    lead_cost_timing: 'after_first_session',
    referral_code_applies_to_continuation: false,
    referral_code_applies_to_reenrollment: true,
    external_referral_enabled: true,
    external_referral_reward_amount: 300,
    external_referral_reward_type: 'upi_transfer',
    external_referral_min_payout: 100,
    external_referral_auto_approve: false,
    parent_referral_reward_type: 'credit',
    inactive_parent_referral_enabled: true,
    influencer_reward_type: 'upi_transfer',
    referral_qr_enabled: true,
    referral_landing_page: '/refer',
    ...overrides,
  };
}

// =============================================================================
// Helper to build chained Supabase mock
// =============================================================================

type MockQueryResult = { data: unknown; error: unknown };

function chainMock(result: MockQueryResult) {
  const chain: Record<string, any> = {};
  const terminal = () => Promise.resolve(result);

  // Every method returns chain for chaining, except single() which resolves
  for (const method of ['select', 'insert', 'update', 'eq', 'in', 'limit', 'not', 'gt', 'gte', 'lt', 'order']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(terminal);
  // Allow select().single() without intermediate calls
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  return chain;
}

// =============================================================================
// Helper to create NextRequest-like objects
// =============================================================================

function makeRequest(body: Record<string, unknown>) {
  return {
    json: () => Promise.resolve(body),
  } as any;
}

function makeGetRequest(phone: string) {
  return {
    url: `https://yestoryd.com/api/referral/register?phone=${phone}`,
  } as any;
}

// =============================================================================
// 1. REFERRAL CODE GENERATION
// =============================================================================

describe('generateReferralCode', () => {
  it('generates code in REF-NAME-XXXX format', () => {
    const code = generateReferralCode('Amit Kumar');
    expect(code).toMatch(/^REF-[A-Z]{1,6}-[A-Z0-9]{4}$/);
  });

  it('extracts uppercase letters from name (max 6)', () => {
    const code = generateReferralCode('Ruchira Rai');
    const namePart = code.split('-')[1];
    expect(namePart).toBe('RUCHIR'); // First 6 alpha chars
  });

  it('handles name with only non-alpha characters', () => {
    const code = generateReferralCode('123 456');
    const namePart = code.split('-')[1];
    expect(namePart).toBe('REF'); // Falls back to REF
  });

  it('generates unique codes on repeated calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateReferralCode('Test'));
    }
    // With 4 alphanumeric random chars, collisions in 20 tries are nearly impossible
    expect(codes.size).toBeGreaterThan(15);
  });

  it('handles short names', () => {
    const code = generateReferralCode('Jo');
    const namePart = code.split('-')[1];
    expect(namePart).toBe('JO');
  });

  it('handles single character name', () => {
    const code = generateReferralCode('A');
    expect(code).toMatch(/^REF-A-[A-Z0-9]{4}$/);
  });
});

// =============================================================================
// 2. REFERRER TYPE → LEAD COST PERCENTAGE (via calculateLeadCost)
// =============================================================================

describe('referrer type determines correct lead cost percentage', () => {
  const config = makeConfig();

  it('coach referrer: 10% of enrollment amount', () => {
    const result = calculateLeadCost(6999, 'starter', 'coach', config);
    expect(result.referrer_share_percent).toBe(10);
    expect(result.referrer_share_amount).toBe(700);
    expect(result.referrer_reward_type).toBe('upi_transfer');
  });

  it('parent referrer: 10% of enrollment amount', () => {
    const result = calculateLeadCost(6999, 'starter', 'parent', config);
    expect(result.referrer_share_percent).toBe(10);
    expect(result.referrer_share_amount).toBe(700);
    expect(result.referrer_reward_type).toBe('credit');
  });

  it('external referrer: 5% of enrollment amount', () => {
    const result = calculateLeadCost(6999, 'starter', 'external', config);
    expect(result.referrer_share_percent).toBe(5);
    expect(result.referrer_share_amount).toBe(350);
    expect(result.referrer_reward_type).toBe('upi_transfer');
  });

  it('influencer referrer: 10% of enrollment amount', () => {
    const result = calculateLeadCost(6999, 'starter', 'influencer', config);
    expect(result.referrer_share_percent).toBe(10);
    expect(result.referrer_share_amount).toBe(700);
    expect(result.referrer_reward_type).toBe('upi_transfer');
  });

  it('organic (no referrer): 0% lead cost', () => {
    const result = calculateLeadCost(6999, 'starter', 'organic', config);
    expect(result.referrer_share_percent).toBe(0);
    expect(result.referrer_share_amount).toBe(0);
    expect(result.referrer_reward_type).toBeNull();
  });

  it('influencer with custom override: uses override percent', () => {
    const result = calculateLeadCost(6999, 'starter', 'influencer', config, 15);
    expect(result.referrer_share_percent).toBe(15);
    expect(result.referrer_share_amount).toBe(1050);
  });
});

// =============================================================================
// 3. REWARD INFO LOGIC (mirrors getRewardInfo in the route)
// =============================================================================

describe('reward info by referrer type', () => {
  const config = makeConfig();

  // Re-implement getRewardInfo as it's not exported — test the logic
  function getRewardInfo(referrerType: ReferrerType) {
    const percentKey = `lead_cost_referrer_percent_${referrerType}` as keyof typeof config;
    return {
      referrer_percent: (config[percentKey] as number) || 0,
      reward_type: referrerType === 'parent'
        ? config.parent_referral_reward_type
        : referrerType === 'influencer'
          ? config.influencer_reward_type
          : referrerType === 'coach'
            ? 'upi_transfer'
            : config.external_referral_reward_type,
      external_reward_amount: referrerType === 'external' ? config.external_referral_reward_amount : null,
    };
  }

  it('coach: 10%, upi_transfer, no external_reward_amount', () => {
    const info = getRewardInfo('coach');
    expect(info.referrer_percent).toBe(10);
    expect(info.reward_type).toBe('upi_transfer');
    expect(info.external_reward_amount).toBeNull();
  });

  it('parent: 10%, credit, no external_reward_amount', () => {
    const info = getRewardInfo('parent');
    expect(info.referrer_percent).toBe(10);
    expect(info.reward_type).toBe('credit');
    expect(info.external_reward_amount).toBeNull();
  });

  it('external: 5%, upi_transfer, has external_reward_amount of 300', () => {
    const info = getRewardInfo('external');
    expect(info.referrer_percent).toBe(5);
    expect(info.reward_type).toBe('upi_transfer');
    expect(info.external_reward_amount).toBe(300);
  });

  it('influencer: 10%, upi_transfer, no external_reward_amount', () => {
    const info = getRewardInfo('influencer');
    expect(info.referrer_percent).toBe(10);
    expect(info.reward_type).toBe('upi_transfer');
    expect(info.external_reward_amount).toBeNull();
  });
});

// =============================================================================
// 4. INPUT VALIDATION (phone regex from schema)
// =============================================================================

describe('phone validation regex', () => {
  const phoneRegex = /^[6-9]\d{9}$/;

  it('accepts valid 10-digit Indian mobile starting with 6', () => {
    expect(phoneRegex.test('6123456789')).toBe(true);
  });

  it('accepts valid 10-digit Indian mobile starting with 9', () => {
    expect(phoneRegex.test('9687606177')).toBe(true);
  });

  it('rejects number starting with 5', () => {
    expect(phoneRegex.test('5123456789')).toBe(false);
  });

  it('rejects number starting with 0', () => {
    expect(phoneRegex.test('0123456789')).toBe(false);
  });

  it('rejects 9-digit number', () => {
    expect(phoneRegex.test('912345678')).toBe(false);
  });

  it('rejects 11-digit number', () => {
    expect(phoneRegex.test('91234567890')).toBe(false);
  });

  it('rejects number with +91 prefix', () => {
    expect(phoneRegex.test('+919687606177')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(phoneRegex.test('')).toBe(false);
  });
});

// =============================================================================
// 5. ROUTE POST HANDLER — via mocked supabaseAdmin
// =============================================================================

describe('POST /api/referral/register', () => {
  let POST: typeof import('@/app/api/referral/register/route').POST;

  beforeAll(async () => {
    const mod = await import('@/app/api/referral/register/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadPayoutConfig.mockResolvedValue(makeConfig());
  });

  it('returns 400 for invalid JSON body', async () => {
    const request = {
      json: () => Promise.reject(new Error('bad json')),
    } as any;

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid JSON body');
  });

  it('returns 400 for missing required fields', async () => {
    const request = makeRequest({ name: 'A' }); // name too short (min 2), no phone

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 for invalid phone number', async () => {
    const request = makeRequest({ name: 'Amit', phone: '1234567890' }); // starts with 1

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 403 when external referrals are disabled', async () => {
    mockLoadPayoutConfig.mockResolvedValue(makeConfig({ external_referral_enabled: false }));

    const request = makeRequest({ name: 'Amit Kumar', phone: '9687606177' });
    const response = await POST(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('disabled');
  });

  it('returns existing referrer for duplicate phone (is_existing=true)', async () => {
    const existingReferrer = {
      id: 'ref-1',
      referral_code: 'REF-AMIT-XY12',
      referrer_type: 'parent',
      is_active: true,
      name: 'Amit',
      total_referrals: 5,
      total_conversions: 2,
      total_earned: 1400,
      total_redeemed: 700,
      total_pending: 700,
    };

    // referrers.select().eq().single() → existing referrer
    const referrerChain = chainMock({ data: existingReferrer, error: null });
    mockFrom.mockReturnValue(referrerChain);

    const request = makeRequest({ name: 'Amit Kumar', phone: '9687606177' });
    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.is_existing).toBe(true);
    expect(body.referral_code).toBe('REF-AMIT-XY12');
    expect(body.referrer_type).toBe('parent');
    expect(body.stats.total_referrals).toBe(5);
  });

  it('reactivates inactive existing referrer', async () => {
    const inactiveReferrer = {
      id: 'ref-2',
      referral_code: 'REF-RUCHA-AB34',
      referrer_type: 'external',
      is_active: false,
      name: 'Rucha',
      total_referrals: 0,
      total_conversions: 0,
      total_earned: 0,
      total_redeemed: 0,
      total_pending: 0,
    };

    // First call: referrers lookup (returns inactive)
    // Second call: referrers update (reactivate)
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return chainMock({ data: inactiveReferrer, error: null });
      }
      // update call
      return chainMock({ data: null, error: null });
    });

    const request = makeRequest({ name: 'Rucha Rai', phone: '9876543210' });
    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.is_existing).toBe(true);
    // Verify update was called (reactivation)
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('registers new external referrer successfully', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // referrers lookup: not found
        return chainMock({ data: null, error: { code: 'PGRST116' } });
      }
      if (callCount === 2) {
        // parents lookup: not found
        return chainMock({ data: null, error: { code: 'PGRST116' } });
      }
      if (callCount === 3) {
        // coaches lookup: not found
        return chainMock({ data: null, error: { code: 'PGRST116' } });
      }
      if (callCount === 4) {
        // referral code collision check: no collision
        return chainMock({ data: null, error: null });
      }
      if (callCount === 5) {
        // insert referrer: success
        return chainMock({
          data: { id: 'new-ref', referral_code: 'REF-NEWEX-AB12', referrer_type: 'external' },
          error: null,
        });
      }
      return chainMock({ data: null, error: null });
    });

    const request = makeRequest({ name: 'New External', phone: '9111222333' });
    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.is_existing).toBe(false);
    expect(body.referrer_type).toBe('external');
    expect(body.referral_link).toContain('ref=');
  });

  it('auto-detects parent referrer type from parents table', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // referrers lookup: not found
        return chainMock({ data: null, error: { code: 'PGRST116' } });
      }
      if (callCount === 2) {
        // parents lookup: FOUND — auto-detect as parent
        return chainMock({ data: { id: 'parent-123' }, error: null });
      }
      if (callCount === 3) {
        // referral code collision check: no collision
        return chainMock({ data: null, error: null });
      }
      if (callCount === 4) {
        // insert referrer
        return chainMock({
          data: { id: 'new-ref', referral_code: 'REF-PARENT-XY99', referrer_type: 'parent' },
          error: null,
        });
      }
      return chainMock({ data: null, error: null });
    });

    const request = makeRequest({ name: 'Parent User', phone: '9876543210' });
    const response = await POST(request);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.referrer_type).toBe('parent');
  });

  it('auto-detects coach referrer type from coaches table', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // referrers lookup: not found
        return chainMock({ data: null, error: { code: 'PGRST116' } });
      }
      if (callCount === 2) {
        // parents lookup: not found
        return chainMock({ data: null, error: { code: 'PGRST116' } });
      }
      if (callCount === 3) {
        // coaches lookup: FOUND — auto-detect as coach
        return chainMock({ data: { id: 'coach-456' }, error: null });
      }
      if (callCount === 4) {
        // referral code collision check
        return chainMock({ data: null, error: null });
      }
      if (callCount === 5) {
        // insert referrer
        return chainMock({
          data: { id: 'new-ref', referral_code: 'REF-COACH-ZZ11', referrer_type: 'coach' },
          error: null,
        });
      }
      return chainMock({ data: null, error: null });
    });

    const request = makeRequest({ name: 'Coach User', phone: '9123456789' });
    const response = await POST(request);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.referrer_type).toBe('coach');
  });

  it('handles race condition on duplicate insert (23505) gracefully', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // referrers lookup: not found
        return chainMock({ data: null, error: { code: 'PGRST116' } });
      }
      if (callCount === 2) {
        // parents lookup: not found
        return chainMock({ data: null, error: { code: 'PGRST116' } });
      }
      if (callCount === 3) {
        // coaches lookup: not found
        return chainMock({ data: null, error: { code: 'PGRST116' } });
      }
      if (callCount === 4) {
        // code collision: no collision
        return chainMock({ data: null, error: null });
      }
      if (callCount === 5) {
        // insert: unique constraint violation (race condition)
        return chainMock({ data: null, error: { code: '23505', message: 'duplicate' } });
      }
      if (callCount === 6) {
        // re-fetch after race condition
        return chainMock({
          data: { referral_code: 'REF-RACED-AA11', referrer_type: 'external' },
          error: null,
        });
      }
      return chainMock({ data: null, error: null });
    });

    const request = makeRequest({ name: 'Race User', phone: '9222333444' });
    const response = await POST(request);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.is_existing).toBe(true);
    expect(body.referral_code).toBe('REF-RACED-AA11');
  });

  it('returns 500 when insert fails with non-duplicate error', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chainMock({ data: null, error: { code: 'PGRST116' } });
      if (callCount === 2) return chainMock({ data: null, error: { code: 'PGRST116' } });
      if (callCount === 3) return chainMock({ data: null, error: { code: 'PGRST116' } });
      if (callCount === 4) return chainMock({ data: null, error: null });
      if (callCount === 5) {
        // insert: generic failure
        return chainMock({ data: null, error: { code: '42P01', message: 'table not found' } });
      }
      return chainMock({ data: null, error: null });
    });

    const request = makeRequest({ name: 'Fail User', phone: '9333444555' });
    const response = await POST(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Registration failed');
  });

  it('returns 500 when all 5 code generation attempts collide', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chainMock({ data: null, error: { code: 'PGRST116' } }); // referrer lookup
      if (callCount === 2) return chainMock({ data: null, error: { code: 'PGRST116' } }); // parent
      if (callCount === 3) return chainMock({ data: null, error: { code: 'PGRST116' } }); // coach
      // Collision checks: all 5 attempts find existing code
      return chainMock({ data: { id: 'existing-code' }, error: null });
    });

    const request = makeRequest({ name: 'Collider', phone: '9444555666' });
    const response = await POST(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('unique referral code');
  });

  it('returns 500 on unexpected thrown error', async () => {
    mockLoadPayoutConfig.mockRejectedValue(new Error('DB connection lost'));

    const request = makeRequest({ name: 'Crash User', phone: '9555666777' });
    const response = await POST(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Internal server error');
  });
});

// =============================================================================
// 6. ROUTE GET HANDLER
// =============================================================================

describe('GET /api/referral/register', () => {
  let GET: typeof import('@/app/api/referral/register/route').GET;

  beforeAll(async () => {
    const mod = await import('@/app/api/referral/register/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for missing phone param', async () => {
    const request = { url: 'https://yestoryd.com/api/referral/register' } as any;
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid phone', async () => {
    const request = makeGetRequest('12345');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('returns found=false for non-existent referrer', async () => {
    mockFrom.mockReturnValue(chainMock({ data: null, error: { code: 'PGRST116' } }));

    const request = makeGetRequest('9876543210');
    const response = await GET(request);
    const body = await response.json();
    expect(body.found).toBe(false);
  });

  it('returns referrer details for existing referrer', async () => {
    const referrer = {
      id: 'ref-1',
      name: 'Amit',
      referral_code: 'REF-AMIT-XY12',
      referrer_type: 'parent',
      total_referrals: 3,
      total_conversions: 1,
      total_earned: 700,
      total_redeemed: 0,
      total_pending: 700,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };
    mockFrom.mockReturnValue(chainMock({ data: referrer, error: null }));

    const request = makeGetRequest('9687606177');
    const response = await GET(request);
    const body = await response.json();

    expect(body.found).toBe(true);
    expect(body.name).toBe('Amit');
    expect(body.referral_code).toBe('REF-AMIT-XY12');
    expect(body.referrer_type).toBe('parent');
    expect(body.stats.total_referrals).toBe(3);
    expect(body.is_active).toBe(true);
  });
});

// =============================================================================
// 7. LEAD COST WITH REFERRER TYPE — DECAY BY ENROLLMENT TYPE
//    Ensures referrer type established at registration flows through to payouts
// =============================================================================

describe('lead cost decay by enrollment type per referrer type', () => {
  const config = makeConfig();

  const referrerTypes: ReferrerType[] = ['coach', 'parent', 'external', 'influencer'];
  const expectedBasePercents: Record<ReferrerType, number> = {
    coach: 10,
    parent: 10,
    external: 5,
    influencer: 10,
  };

  for (const type of referrerTypes) {
    const base = expectedBasePercents[type];

    it(`${type}: starter = ${base}%, continuation = ${base * 0.5}%, reenrollment = 0%`, () => {
      const starter = calculateLeadCost(6999, 'starter', type, config);
      expect(starter.referrer_share_percent).toBe(base);

      const continuation = calculateLeadCost(6999, 'continuation', type, config);
      expect(continuation.referrer_share_percent).toBe(base * 0.5);

      const reenroll = calculateLeadCost(6999, 'reenrollment', type, config);
      expect(reenroll.referrer_share_percent).toBe(0);
    });
  }
});

// =============================================================================
// 8. EDGE CASE: name validation boundaries
// =============================================================================

describe('name validation edge cases', () => {
  // The zod schema requires min(2) max(100)
  // Import zod at top of describe since it's already available
  const { z } = require('zod');
  const nameSchema = z.string().min(2).max(100).trim();

  it('name with exactly 2 chars is valid', () => {
    expect(nameSchema.safeParse('Jo').success).toBe(true);
  });

  it('name with 1 char is invalid', () => {
    expect(nameSchema.safeParse('J').success).toBe(false);
  });

  it('name with 100 chars is valid', () => {
    expect(nameSchema.safeParse('A'.repeat(100)).success).toBe(true);
  });

  it('name with 101 chars is invalid', () => {
    expect(nameSchema.safeParse('A'.repeat(101)).success).toBe(false);
  });

  it('name "J " passes validation (zod min checks pre-trim length)', () => {
    // zod.trim() is a transform, min(2) checks raw input length ("J " = 2 chars)
    // This means "J " passes min(2) then gets trimmed to "J" — a known zod quirk
    expect(nameSchema.safeParse('J ').success).toBe(true);
  });
});
