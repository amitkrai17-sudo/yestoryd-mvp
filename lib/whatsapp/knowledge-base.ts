// ============================================================
// Lead Bot Knowledge Base
// Rich context document for FAQ handler's Gemini prompt.
// Combines dynamic DB data (pricing, age bands, site settings)
// with static program knowledge.
// Cache TTL: 10 minutes.
// ============================================================

import {
  getPricingConfig,
  getSessionRangeForTier,
  getDurationRange,
  getPerWeekPrice,
  getSessionCount,
} from '@/lib/config/pricing-config';
import { getSettingsForCategories } from '@/lib/settings/getSettings';
import { getLeadBotUrls } from '@/lib/whatsapp/urls';

// ============================================================
// Cache
// ============================================================

let knowledgeCache: { text: string; loadedAt: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ============================================================
// Main export
// ============================================================

export async function getLeadBotKnowledge(): Promise<string> {
  if (knowledgeCache && Date.now() - knowledgeCache.loadedAt < CACHE_TTL) {
    return knowledgeCache.text;
  }

  const [config, settings, urls] = await Promise.all([
    getPricingConfig(),
    getSettingsForCategories(['pricing', 'faq', 'testimonials', 'assessment', 'content']),
    getLeadBotUrls(),
  ]);

  // --- Dynamic pricing section ---
  const perWeek = getPerWeekPrice(config);
  const durRange = getDurationRange(config);
  const durationStr = durRange.min === durRange.max
    ? `${durRange.min} minutes`
    : `${durRange.min}–${durRange.max} minutes`;

  const fmtRange = (r: { min: number; max: number }) =>
    r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;

  const tierLines = config.tiers.map(t => {
    const range = getSessionRangeForTier(config, t.slug);
    return `  - ${t.name}: ₹${t.discountedPrice.toLocaleString('en-IN')} for ${t.durationWeeks} weeks (${fmtRange(range)} sessions)`;
  }).join('\n');

  // --- Age band details ---
  const ageBandLines = config.ageBands.map(band => {
    const sessionCounts = config.tiers.map(t => {
      const count = getSessionCount(config, band.id, t.slug);
      return `${t.name}: ${count}`;
    }).join(', ');
    return `  - ${band.displayName} (ages ${band.ageMin}–${band.ageMax}): ${band.sessionDurationMinutes}-min sessions, ${band.sessionsPerWeek}x/week (${sessionCounts})`;
  }).join('\n');

  // --- Site settings as flat facts ---
  const settingsFacts: string[] = [];
  for (const [, categorySettings] of Object.entries(settings)) {
    if (typeof categorySettings !== 'object' || !categorySettings) continue;
    for (const [key, value] of Object.entries(categorySettings as unknown as Record<string, unknown>)) {
      if (value && typeof value === 'string' && value.trim().length > 0) {
        settingsFacts.push(`${key}: ${value}`);
      }
    }
  }

  const text = `ABOUT YESTORYD:
AI-powered 1:1 reading coaching for children aged 4-12.
Based in India, sessions via Google Meet.
Founded by Rucha Rai, certified Jolly Phonics instructor.
ARC Method: Assess → Remediate → Celebrate.
Website: https://www.yestoryd.com

PRICING:
Starts at ₹${perWeek}/week for personalized 1:1 coaching.
${tierLines}
Each session is ${durationStr} with a certified reading coach on Google Meet.

SESSION STRUCTURE BY AGE:
${ageBandLines}

WHAT WE COVER:
- Phonics & letter sounds (ages 4-6)
- Reading fluency & confidence (ages 7-9)
- Comprehension & analytical skills (ages 10-12)
- Olympiad preparation (reading comprehension section)
- CBSE/ICSE English curriculum alignment
- Oxford Reading Tree levels

COACHING FORMAT:
- Live 1:1 sessions on Google Meet (not group classes)
- Certified reading coaches (not tutors)
- AI-powered progress tracking (rAI)
- Parent progress updates after each session
- E-learning modules between sessions
- Session recordings available

ASSESSMENT:
- Free, takes 3-5 minutes
- AI-powered (Gemini) analysis
- Tests: letter recognition, phonics, fluency, comprehension
- Instant results with personalized recommendations
- No commitment required
- Link: ${urls.assessmentUrl}

DISCOVERY CALL:
- Free 15-minute call
- Meet your child's potential coach
- Discuss your child's specific needs
- Get a personalized reading plan
- No pressure, no commitment

COMMON OBJECTIONS:
- "Too expensive" → Starts at ₹${perWeek}/week, cheaper than most tuition
- "My child reads fine" → Assessment often reveals hidden gaps parents don't notice
- "No time" → Just ${durationStr}/week, flexible scheduling
- "Online won't work" → 1:1 attention is better than group classes
- "How is this different from tuition" → Reading intelligence, not rote learning. AI tracks 50+ reading skills.
- "Is my child too young/old?" → We work with ages 4-12 with age-appropriate methods

WHEN TO ENROLL:
- Any time! Assessment is instant.
- Best ages: 4-8 (early intervention = better outcomes)
- Summer is popular but not required.
- No batch system — your child starts their own journey.

${settingsFacts.length > 0 ? `ADDITIONAL FACTS:\n${settingsFacts.join('\n')}` : ''}`.trim();

  knowledgeCache = { text, loadedAt: Date.now() };
  return text;
}
