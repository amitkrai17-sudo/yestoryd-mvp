// ============================================================
// GET /api/intelligence/skills
// Returns el_skills grouped by el_modules, filtered by
// scope IN ('observation', 'both'). Used by structured capture
// form to populate skill selectors.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

interface SkillRow {
  id: string;
  name: string;
  skill_tag: string;
  description: string | null;
  difficulty: number | null;
  order_index: number;
  scope: string | null;
  module_id: string | null;
  is_active: boolean | null;
}

interface ModuleRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  order_index: number;
  is_active: boolean | null;
}

export async function GET() {
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  const supabase = getServiceSupabase();

  // Fetch active skills with scope = observation or both
  const { data: skills, error: skillsError } = await supabase
    .from('el_skills')
    .select('id, name, skill_tag, description, difficulty, order_index, scope, module_id, is_active')
    .eq('is_active', true)
    .in('scope', ['observation', 'both'])
    .order('order_index', { ascending: true });

  if (skillsError) {
    console.error('Failed to fetch skills:', skillsError);
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 });
  }

  // Fetch active modules
  const { data: modules, error: modulesError } = await supabase
    .from('el_modules')
    .select('id, name, slug, icon, order_index, is_active')
    .eq('is_active', true)
    .order('order_index', { ascending: true });

  if (modulesError) {
    console.error('Failed to fetch modules:', modulesError);
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 });
  }

  // Group skills by module
  const moduleMap = new Map<string, ModuleRow>();
  for (const mod of (modules || []) as ModuleRow[]) {
    moduleMap.set(mod.id, mod);
  }

  const grouped: Array<{
    module: { id: string; name: string; slug: string; icon: string | null; orderIndex: number };
    skills: Array<{ id: string; name: string; skillTag: string; description: string | null; difficulty: number | null; orderIndex: number }>;
  }> = [];

  // Skills without a module go into "Other"
  const skillsByModule = new Map<string, SkillRow[]>();
  for (const skill of (skills || []) as SkillRow[]) {
    const key = skill.module_id || '__other__';
    if (!skillsByModule.has(key)) {
      skillsByModule.set(key, []);
    }
    skillsByModule.get(key)!.push(skill);
  }

  // Build grouped response in module order
  for (const mod of (modules || []) as ModuleRow[]) {
    const moduleSkills = skillsByModule.get(mod.id);
    if (moduleSkills && moduleSkills.length > 0) {
      grouped.push({
        module: {
          id: mod.id,
          name: mod.name,
          slug: mod.slug,
          icon: mod.icon,
          orderIndex: mod.order_index,
        },
        skills: moduleSkills.map(s => ({
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

  // Add ungrouped skills
  const otherSkills = skillsByModule.get('__other__');
  if (otherSkills && otherSkills.length > 0) {
    grouped.push({
      module: { id: '__other__', name: 'Other', slug: 'other', icon: null, orderIndex: 999 },
      skills: otherSkills.map(s => ({
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
