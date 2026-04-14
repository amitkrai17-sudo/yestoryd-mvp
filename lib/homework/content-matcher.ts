// ============================================================
// FILE: lib/homework/content-matcher.ts
// PURPOSE: Match worksheets/content from el_content_items to homework tasks
// based on session signals (skills covered, performance, child YRL).
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

export interface MatchResult {
  contentItemId: string;
  title: string;
  contentType: string;
  assetUrl: string | null;
  assetFormat: string | null;
  parentInstruction: string | null;
  coachGuidance: string | null;
  yrlLevel: string | null;
  arcStage: string | null;
  matchReason: string;
}

export interface MatchParams {
  skills: string[];              // UUIDs (el_skills.id) OR slugs (e.g., 'phonics', 'comprehension')
  childYrl: string | null;       // e.g., "F1", "B2", "M1"
  childId: string;
  performanceLevel?: string;     // Accepts either "Poor"|"Fair"|"Good"|"Excellent"
                                 // OR SkillRating enum "struggling"|"developing"|"proficient"|"advanced"
  contentType?: string;          // default 'worksheet'
}

/**
 * Accept either the legacy fluency labels or the SCF SkillRating enum and
 * return the canonical Poor/Fair/Good/Excellent label. Used by the matcher
 * and the coach upload route so both callers agree on arc_stage derivation.
 */
export function normalizePerformanceLevel(input?: string | null): string | undefined {
  if (!input) return undefined;
  const v = String(input).toLowerCase().trim();
  switch (v) {
    case 'poor': case 'struggling': return 'Poor';
    case 'fair': case 'developing': return 'Fair';
    case 'good': case 'proficient': return 'Good';
    case 'excellent': case 'advanced': return 'Excellent';
    default: return undefined;
  }
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YRL_ORDER = ['F1','F2','F3','F4','B1','B2','B3','B4','M1','M2','M3','M4'];
const YRL_INDEX = new Map<string, number>(YRL_ORDER.map((y, i) => [y, i]));

export async function matchContentForSession(
  params: MatchParams
): Promise<MatchResult | null> {
  const { skills, childYrl, childId, performanceLevel, contentType = 'worksheet' } = params;
  if (!skills || skills.length === 0) return null;

  const supabase = createAdminClient();

  // 1. Resolve inputs → el_skills.id UUIDs
  const skillIds = await resolveSkillIds(supabase, skills);
  if (skillIds.length === 0) return null;

  // 2. Determine preferred ARC stage from performance (accept either rating vocabulary)
  const preferredArc = arcFromPerformance(performanceLevel);

  // 3. Fetch tagged candidates
  const { data: candidates, error } = await supabase
    .from('el_content_tags')
    .select(`
      content_item_id,
      skill_id,
      relevance_score,
      is_primary,
      el_content_items!inner (
        id, title, content_type, asset_url, asset_format,
        parent_instruction, coach_guidance,
        yrl_level, arc_stage, is_active
      )
    `)
    .in('skill_id', skillIds)
    .eq('el_content_items.content_type', contentType)
    .eq('el_content_items.is_active', true);

  if (error || !candidates || candidates.length === 0) return null;

  // 4. Score and rank
  type Scored = {
    item: any;
    skillId: string;
    score: number;
  };
  const scored: Scored[] = candidates.map((c: any) => {
    const item = c.el_content_items;
    let score = 0;

    if (childYrl && item.yrl_level) {
      if (item.yrl_level === childYrl) score += 10;
      else if (isAdjacentYrl(childYrl, item.yrl_level)) score += 5;
      else score += 1;
    } else {
      score += 3;
    }

    if (preferredArc && item.arc_stage === preferredArc) score += 5;
    if (c.is_primary) score += 3;
    score += (c.relevance_score ?? 0);

    return { item, skillId: c.skill_id, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // 5. Repeat gate: skip items sent to this child in last 14 days
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const { data: recentTasks } = await supabase
    .from('parent_daily_tasks')
    .select('content_item_id')
    .eq('child_id', childId)
    .not('content_item_id', 'is', null)
    .gte('task_date', cutoff);

  const recentIds = new Set((recentTasks ?? []).map(t => t.content_item_id));
  const best = scored.find(s => !recentIds.has(s.item.id));
  if (!best) return null;

  return {
    contentItemId: best.item.id,
    title: best.item.title,
    contentType: best.item.content_type,
    assetUrl: best.item.asset_url,
    assetFormat: best.item.asset_format,
    parentInstruction: best.item.parent_instruction,
    coachGuidance: best.item.coach_guidance,
    yrlLevel: best.item.yrl_level,
    arcStage: best.item.arc_stage,
    matchReason: `skill:${best.skillId.slice(0, 8)} + yrl:${best.item.yrl_level ?? '?'} + arc:${best.item.arc_stage ?? '?'} (score ${best.score})`,
  };
}

// ─── Helpers ───────────────────────────────────────────────

async function resolveSkillIds(
  supabase: ReturnType<typeof createAdminClient>,
  inputs: string[]
): Promise<string[]> {
  const uuids: string[] = [];
  const slugs: string[] = [];
  for (const s of inputs) {
    if (!s) continue;
    if (UUID_RX.test(s)) uuids.push(s);
    else slugs.push(s.toLowerCase().trim());
  }

  if (slugs.length === 0) return uuids;

  // Normalize slugs: 'phonemic_awareness' → also try 'phonemic awareness'
  const nameCandidates = new Set<string>();
  for (const slug of slugs) {
    nameCandidates.add(slug);
    nameCandidates.add(slug.replace(/_/g, ' '));
    nameCandidates.add(slug.replace(/-/g, ' '));
  }

  // Try el_skills first (skill_tag exact OR lowercase name match)
  const { data: skills } = await supabase
    .from('el_skills')
    .select('id, skill_tag, name, module_id')
    .or(
      `skill_tag.in.(${slugs.map(s => `"${s}"`).join(',')}),name.in.(${Array.from(nameCandidates).map(n => `"${n}"`).join(',')})`
    );
  const resolved = new Set<string>(uuids);
  if (skills) for (const s of skills) resolved.add(s.id);

  // If no direct el_skills match, fall back to el_modules → all skills under matching modules
  if (resolved.size === uuids.length) {
    const { data: modules } = await supabase
      .from('el_modules')
      .select('id')
      .or(
        `slug.in.(${slugs.map(s => `"${s}"`).join(',')}),name.in.(${Array.from(nameCandidates).map(n => `"${n}"`).join(',')})`
      );
    const moduleIds = (modules ?? []).map((m: any) => m.id);
    if (moduleIds.length > 0) {
      const { data: moduleSkills } = await supabase
        .from('el_skills')
        .select('id')
        .in('module_id', moduleIds);
      if (moduleSkills) for (const s of moduleSkills) resolved.add(s.id);
    }
  }

  return Array.from(resolved);
}

/**
 * Canonical performance label → ARC stage. Accepts raw labels — callers
 * that have SkillRating enums should pipe through normalizePerformanceLevel() first.
 */
export function arcFromPerformance(performance?: string | null): 'remediate' | 'celebrate' | null {
  const canonical = normalizePerformanceLevel(performance ?? undefined);
  switch (canonical) {
    case 'Poor':
    case 'Fair':
      return 'remediate';
    case 'Good':
    case 'Excellent':
      return 'celebrate';
    default:
      return null;
  }
}

/**
 * Pick the dominant rating across a SkillPerformance map. Handles both
 * SCF manual captures ({ rating }) and voice captures ({ fluency }).
 */
export function deriveDominantPerformance(
  perfs: Record<string, { fluency?: string | null; rating?: string | null }> | null | undefined
): string | undefined {
  if (!perfs || typeof perfs !== 'object') return undefined;
  const counts: Record<string, number> = {};
  for (const p of Object.values(perfs)) {
    const v = p?.rating || p?.fluency;
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  let best: string | undefined;
  let max = -1;
  for (const [k, v] of Object.entries(counts)) if (v > max) { best = k; max = v; }
  return best;
}

function isAdjacentYrl(a: string, b: string): boolean {
  const ai = YRL_INDEX.get(a);
  const bi = YRL_INDEX.get(b);
  if (ai === undefined || bi === undefined) return false;
  return Math.abs(ai - bi) <= 1;
}
