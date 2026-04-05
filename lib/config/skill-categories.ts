// =============================================================================
// SHARED SKILL CATEGORIES LOADER
// lib/config/skill-categories.ts
//
// Single source of truth for the skill/category taxonomy.
// Fetches from skill_categories + el_modules with 5-min cache.
// Server-side only (uses admin client).
//
// Usage:
//   import { getSkillCategories, getCoachCategories, getParentCategories } from '@/lib/config/skill-categories';
//   const all = await getSkillCategories();
//   const coachOnly = await getCoachCategories();
//   const cat = await getCategoryBySlug('phonics_letter_sounds');
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// TYPES
// =============================================================================

export interface RubricDefinitions {
  emerging: string;
  developing: string;
  proficient: string;
  mastered: string;
}

export interface SkillCategory {
  id: string;
  slug: string;
  label: string;
  parentLabel: string | null;
  labelHindi: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  scope: 'coach' | 'parent' | 'both';
  isActive: boolean;
  rubric: RubricDefinitions | null;
  voicePrompts?: { q1: string; q2: string; q3: string; q4: string } | null;
}

export interface SkillCategoryWithModules extends SkillCategory {
  modules: SkillModule[];
}

export interface SkillModule {
  id: string;
  name: string;
  categoryId: string | null;
}

// =============================================================================
// CACHE
// =============================================================================

interface CacheEntry {
  categories: SkillCategory[];
  modules: SkillModule[];
  loadedAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid(entry: CacheEntry | null): entry is CacheEntry {
  return entry != null && Date.now() - entry.loadedAt < CACHE_TTL;
}

/** Force-clear cache (useful after admin edits). */
export function invalidateSkillCategoriesCache(): void {
  cache = null;
}

// =============================================================================
// HARDCODED FALLBACKS (used only if DB fetch fails)
// =============================================================================

const FALLBACK_CATEGORIES: SkillCategory[] = [
  { id: '', slug: 'phonics_letter_sounds', label: 'Phonics & Letter Sounds', parentLabel: 'Reading & Phonics', labelHindi: null, icon: 'Volume2', color: '#ef4444', sortOrder: 1, scope: 'both', isActive: true, rubric: null },
  { id: '', slug: 'reading_fluency', label: 'Reading Fluency', parentLabel: 'Reading & Fluency', labelHindi: null, icon: 'BookOpen', color: '#f97316', sortOrder: 2, scope: 'both', isActive: true, rubric: null },
  { id: '', slug: 'reading_comprehension', label: 'Reading Comprehension', parentLabel: 'Comprehension', labelHindi: null, icon: 'Brain', color: '#eab308', sortOrder: 3, scope: 'both', isActive: true, rubric: null },
  { id: '', slug: 'vocabulary_building', label: 'Vocabulary Building', parentLabel: 'Vocabulary', labelHindi: null, icon: 'Library', color: '#22c55e', sortOrder: 4, scope: 'both', isActive: true, rubric: null },
  { id: '', slug: 'grammar_syntax', label: 'Grammar & Syntax', parentLabel: 'Grammar', labelHindi: null, icon: 'PenTool', color: '#3b82f6', sortOrder: 5, scope: 'both', isActive: true, rubric: null },
  { id: '', slug: 'creative_writing', label: 'Creative Writing', parentLabel: 'Creative Writing', labelHindi: null, icon: 'Feather', color: '#8b5cf6', sortOrder: 6, scope: 'both', isActive: true, rubric: null },
  { id: '', slug: 'pronunciation', label: 'Pronunciation & Speaking', parentLabel: 'Speaking & Confidence', labelHindi: null, icon: 'Mic', color: '#ec4899', sortOrder: 7, scope: 'both', isActive: true, rubric: null },
  { id: '', slug: 'story_analysis', label: 'Story Analysis', parentLabel: 'Story Analysis', labelHindi: null, icon: 'Search', color: '#06b6d4', sortOrder: 8, scope: 'both', isActive: true, rubric: null },
  { id: '', slug: 'olympiad_prep', label: 'Olympiad Prep', parentLabel: 'Olympiad Preparation', labelHindi: null, icon: 'Trophy', color: '#f59e0b', sortOrder: 9, scope: 'parent', isActive: true, rubric: null },
  { id: '', slug: 'competition_prep', label: 'Competition Prep', parentLabel: 'Competition Preparation', labelHindi: null, icon: 'Award', color: '#10b981', sortOrder: 10, scope: 'parent', isActive: true, rubric: null },
];

// =============================================================================
// MAIN LOADER
// =============================================================================

async function loadFromDB(): Promise<CacheEntry> {
  try {
    const supabase = createAdminClient();

    const [catResult, modResult] = await Promise.all([
      supabase
        .from('skill_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('el_modules')
        .select('id, name, category_id'),
    ]);

    if (catResult.error) {
      console.error('[SkillCategories] Failed to fetch skill_categories:', catResult.error);
      return buildFallback();
    }

    const categories: SkillCategory[] = (catResult.data || []).map(row => ({
      id: row.id,
      slug: row.slug,
      label: row.label,
      parentLabel: row.parent_label,
      labelHindi: row.label_hindi,
      icon: row.icon,
      color: row.color,
      sortOrder: row.sort_order,
      scope: row.scope as SkillCategory['scope'],
      isActive: row.is_active,
      rubric: (row as any).rubric as RubricDefinitions | null,
      voicePrompts: (row as any).voice_prompts as { q1: string; q2: string; q3: string; q4: string } | null,
    }));

    const modules: SkillModule[] = (modResult.data || []).map(row => ({
      id: row.id,
      name: row.name,
      categoryId: row.category_id,
    }));

    if (categories.length === 0) {
      console.warn('[SkillCategories] Empty result from DB, using fallbacks');
      return buildFallback();
    }

    const entry: CacheEntry = { categories, modules, loadedAt: Date.now() };
    cache = entry;
    return entry;
  } catch (err) {
    console.error('[SkillCategories] Unexpected error, using fallbacks:', err);
    return buildFallback();
  }
}

function buildFallback(): CacheEntry {
  const entry: CacheEntry = {
    categories: FALLBACK_CATEGORIES,
    modules: [],
    loadedAt: Date.now(),
  };
  cache = entry;
  return entry;
}

async function ensureLoaded(): Promise<CacheEntry> {
  if (isCacheValid(cache)) return cache;
  return loadFromDB();
}

// =============================================================================
// PUBLIC API
// =============================================================================

/** All active skill categories (sorted by sort_order). */
export async function getSkillCategories(): Promise<SkillCategory[]> {
  const entry = await ensureLoaded();
  return entry.categories;
}

/** Categories visible to coaches (scope = 'coach' | 'both'). */
export async function getCoachCategories(): Promise<SkillCategory[]> {
  const entry = await ensureLoaded();
  return entry.categories.filter(c => c.scope === 'coach' || c.scope === 'both');
}

/** Categories visible to parents (scope = 'parent' | 'both'). */
export async function getParentCategories(): Promise<SkillCategory[]> {
  const entry = await ensureLoaded();
  return entry.categories.filter(c => c.scope === 'parent' || c.scope === 'both');
}

/** Look up a single category by slug. */
export async function getCategoryBySlug(slug: string): Promise<SkillCategory | null> {
  const entry = await ensureLoaded();
  return entry.categories.find(c => c.slug === slug) ?? null;
}

/** All categories with their el_modules attached. */
export async function getCategoriesWithModules(): Promise<SkillCategoryWithModules[]> {
  const entry = await ensureLoaded();
  return entry.categories.map(cat => ({
    ...cat,
    modules: entry.modules.filter(m => m.categoryId === cat.id),
  }));
}

/** Get category slug → label map (useful for display). */
export async function getCategoryLabelMap(): Promise<Record<string, string>> {
  const entry = await ensureLoaded();
  const map: Record<string, string> = {};
  for (const c of entry.categories) {
    map[c.slug] = c.label;
  }
  return map;
}

/** Get category slug → color map (useful for chips/badges). */
export async function getCategoryColorMap(): Promise<Record<string, string>> {
  const entry = await ensureLoaded();
  const map: Record<string, string> = {};
  for (const c of entry.categories) {
    map[c.slug] = c.color;
  }
  return map;
}

/** Get all slugs (useful for validation / AI prompts). */
export async function getCategorySlugs(): Promise<string[]> {
  const entry = await ensureLoaded();
  return entry.categories.map(c => c.slug);
}

/** Get parent-facing label for a slug. Falls back to label if parent_label is NULL. */
export async function getParentLabel(slug: string): Promise<string> {
  const cat = await getCategoryBySlug(slug);
  if (!cat) return slug;
  return cat.parentLabel ?? cat.label;
}

/** Get rubric definitions for a category by slug. */
export async function getCategoryRubric(slug: string): Promise<RubricDefinitions | null> {
  const cat = await getCategoryBySlug(slug);
  return cat?.rubric ?? null;
}

/** Get slug → parent-facing label map. */
export async function getParentLabelMap(): Promise<Record<string, string>> {
  const entry = await ensureLoaded();
  const map: Record<string, string> = {};
  for (const c of entry.categories) {
    map[c.slug] = c.parentLabel ?? c.label;
  }
  return map;
}
