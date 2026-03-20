// ============================================================
// GET /api/intelligence/skills
// Returns el_skills grouped by skill_categories (Level 1),
// filtered by scope IN ('observation', 'both').
// Used by structured capture form to populate skill selectors.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  const supabase = getServiceSupabase();

  // 1. Fetch active skills with scope = observation or both, including category_id
  const { data: skills, error: skillsError } = await supabase
    .from('el_skills')
    .select('id, name, skill_tag, description, difficulty, order_index, scope, category_id, is_active')
    .eq('is_active', true)
    .in('scope', ['observation', 'both'])
    .order('order_index', { ascending: true });

  if (skillsError) {
    console.error('Failed to fetch skills:', skillsError);
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 });
  }

  // 2. Fetch coach-visible skill_categories (Level 1 grouping)
  const { data: categories, error: catError } = await supabase
    .from('skill_categories')
    .select('id, slug, label, icon, sort_order, scope, is_active')
    .eq('is_active', true)
    .in('scope', ['coach', 'both'])
    .order('sort_order', { ascending: true });

  if (catError) {
    console.error('Failed to fetch skill_categories:', catError);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }

  // 3. Build category lookup
  const categoryMap = new Map<string, {
    id: string;
    slug: string;
    label: string;
    icon: string | null;
    sortOrder: number;
  }>();
  for (const cat of categories || []) {
    categoryMap.set(cat.id, {
      id: cat.id,
      slug: cat.slug,
      label: cat.label,
      icon: cat.icon,
      sortOrder: cat.sort_order,
    });
  }

  // 4. Group skills by category_id
  const skillsByCategory = new Map<string, typeof skills>();
  for (const skill of skills || []) {
    const key = skill.category_id || '__general__';
    if (!skillsByCategory.has(key)) {
      skillsByCategory.set(key, []);
    }
    skillsByCategory.get(key)!.push(skill);
  }

  // 5. Build grouped response in category sort order
  //    Response shape matches existing ModuleGroup type (module → category)
  const grouped: Array<{
    module: { id: string; name: string; slug: string; icon: string | null; orderIndex: number };
    skills: Array<{ id: string; name: string; skillTag: string; description: string | null; difficulty: number | null; orderIndex: number }>;
  }> = [];

  for (const cat of categories || []) {
    const catSkills = skillsByCategory.get(cat.id);
    if (catSkills && catSkills.length > 0) {
      const info = categoryMap.get(cat.id)!;
      grouped.push({
        module: {
          id: info.id,
          name: info.label,
          slug: info.slug,
          icon: info.icon,
          orderIndex: info.sortOrder,
        },
        skills: catSkills.map(s => ({
          id: s.id,
          name: s.name,
          skillTag: s.skill_tag,
          description: s.description,
          difficulty: s.difficulty,
          orderIndex: s.order_index,
        })),
      });
    }
  }

  // 6. Skills without a category_id (should be rare)
  const generalSkills = skillsByCategory.get('__general__');
  if (generalSkills && generalSkills.length > 0) {
    grouped.push({
      module: { id: '__general__', name: 'General Skills', slug: 'general', icon: null, orderIndex: 999 },
      skills: generalSkills.map(s => ({
        id: s.id,
        name: s.name,
        skillTag: s.skill_tag,
        description: s.description,
        difficulty: s.difficulty,
        orderIndex: s.order_index,
      })),
    });
  }

  return NextResponse.json(
    { success: true, modules: grouped, totalSkills: (skills || []).length },
    {
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=1200',
      },
    },
  );
}
