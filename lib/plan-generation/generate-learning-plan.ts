// ============================================================
// FILE: lib/plan-generation/generate-learning-plan.ts
// PURPOSE: Rule-based learning plan generation from diagnostic data
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
const getSupabase = () => createAdminClient();

// ============================================================
// Types
// ============================================================

interface Template {
  id: string;
  template_code: string;
  title: string;
  age_band: string;
  recommended_order: number;
  difficulty_level: number;
  prerequisites: string[];
  skill_dimensions: string[];
  is_diagnostic: boolean;
  is_season_finale: boolean;
  is_active: boolean;
  duration_minutes: number;
}

export interface TemplateSelection {
  template_id: string;
  template_code: string;
  title: string;
  session_number: number;
  reason: string;
  skill_focus: string[];
  difficulty_level: number;
}

export interface PlanResult {
  success: boolean;
  roadmap_id?: string;
  plan_items?: TemplateSelection[];
  season_name?: string;
  focus_areas?: string[];
  error?: string;
}

// ============================================================
// Template Selection Rules
// ============================================================

function selectFoundationTemplates(
  templates: Template[],
  diag: Record<string, any>,
  totalSessions: number
): TemplateSelection[] {
  const selected: TemplateSelection[] = [];
  const used = new Set<string>();
  const byCode = new Map(templates.map(t => [t.template_code, t]));

  // Helper to add a template if available and not used
  const addIf = (code: string, reason: string) => {
    const t = byCode.get(code);
    if (t && !used.has(code) && t.is_active) {
      used.add(code);
      selected.push({
        template_id: t.id,
        template_code: code,
        title: t.title,
        session_number: 0, // will be assigned later
        reason,
        skill_focus: t.skill_dimensions || [],
        difficulty_level: t.difficulty_level,
      });
    }
  };

  // Skip F01 diagnostic (already done as session 1)
  used.add('F01');

  const letterSounds = diag.letter_sounds_known?.length || 0;
  const canBlend = diag.can_blend_cvc;
  const rhymeDetect = diag.rhyme_detection;
  const listening = diag.listening_comprehension;
  const sightWords = diag.sight_words_known || 0;

  // Core phonics path
  if (letterSounds < 6) {
    addIf('F02', 'Few letter sounds known — needs letter-sound work');
    addIf('F03', 'Build phonological awareness alongside letter sounds');
  }

  if (canBlend === 'no') {
    addIf('F02', 'Cannot blend CVC — start with letter sounds');
    addIf('F04', 'CVC blending practice');
  } else if (canBlend === 'with_support') {
    addIf('F04', 'CVC blending with support — needs practice');
  }

  if (canBlend === 'yes') {
    addIf('F05', 'Can blend — move to sound manipulation');
  }

  if (rhymeDetect === 'not_yet') {
    addIf('F03', 'Rhyme detection not yet developed');
  }

  if (listening === 'strong') {
    addIf('F06', 'Strong listening — can handle oral comprehension tasks');
  }

  if (sightWords === 0) {
    addIf('F09', 'No sight words — introduce high-frequency words');
  }

  // Fill remaining with progressive templates
  const remaining = totalSessions - 1 - selected.length; // -1 for diagnostic session
  if (remaining > 0) {
    const available = templates
      .filter(t => !used.has(t.template_code) && t.is_active && !t.is_diagnostic && !t.is_season_finale)
      .sort((a, b) => a.recommended_order - b.recommended_order);

    for (const t of available) {
      if (selected.length >= totalSessions - 2) break; // leave room for finale
      // Check prerequisites
      const prereqsMet = !t.prerequisites?.length || t.prerequisites.every(p => used.has(p));
      if (prereqsMet) {
        used.add(t.template_code);
        selected.push({
          template_id: t.id,
          template_code: t.template_code,
          title: t.title,
          session_number: 0,
          reason: 'Progressive difficulty fill',
          skill_focus: t.skill_dimensions || [],
          difficulty_level: t.difficulty_level,
        });
      }
    }
  }

  // Always add F15 as final session
  addIf('F15', 'Season review — always final session');

  return selected;
}

function selectBuildingTemplates(
  templates: Template[],
  diag: Record<string, any>,
  totalSessions: number
): TemplateSelection[] {
  const selected: TemplateSelection[] = [];
  const used = new Set<string>();
  const byCode = new Map(templates.map(t => [t.template_code, t]));

  const addIf = (code: string, reason: string) => {
    const t = byCode.get(code);
    if (t && !used.has(code) && t.is_active) {
      used.add(code);
      selected.push({
        template_id: t.id, template_code: code, title: t.title,
        session_number: 0, reason, skill_focus: t.skill_dimensions || [],
        difficulty_level: t.difficulty_level,
      });
    }
  };

  // B01 diagnostic already done
  used.add('B01');

  const decodeLevel = diag.decode_level;
  const compLiteral = diag.comprehension_literal;
  const compInferential = diag.comprehension_inferential;
  const prosody = diag.expression_prosody;
  const writing = diag.writing_ability;
  const sightWords = diag.sight_words_known_of_100 || 0;

  if (decodeLevel === 'cvc_only') {
    addIf('B02', 'Decoding at CVC level — needs decode work');
    addIf('B08', 'Advanced decoding patterns');
  }

  if (compLiteral === 'weak') {
    addIf('B05', 'Weak literal comprehension — priority');
  }

  if (compInferential === 'not_yet') {
    addIf('B05', 'Comprehension before inferencing');
    addIf('B06', 'Inferential comprehension development');
  }

  if (prosody === 'monotone' || prosody === 'word_by_word') {
    addIf('B03', 'Prosody needs work — fluency building');
    addIf('B09', 'Advanced fluency practice');
  }

  if (writing === 'words_only' || writing === 'not_yet') {
    addIf('B07', 'Writing needs foundational work');
    addIf('B10', 'Extended writing skills');
  }

  if (sightWords < 50) {
    addIf('B11', 'Sight word vocabulary below 50');
  }

  // Fill remaining
  const available = templates
    .filter(t => !used.has(t.template_code) && t.is_active && !t.is_diagnostic && !t.is_season_finale)
    .sort((a, b) => a.recommended_order - b.recommended_order);

  for (const t of available) {
    if (selected.length >= totalSessions - 2) break;
    const prereqsMet = !t.prerequisites?.length || t.prerequisites.every(p => used.has(p));
    if (prereqsMet) {
      used.add(t.template_code);
      selected.push({
        template_id: t.id, template_code: t.template_code, title: t.title,
        session_number: 0, reason: 'Progressive difficulty fill',
        skill_focus: t.skill_dimensions || [], difficulty_level: t.difficulty_level,
      });
    }
  }

  addIf('B13', 'Season review — always final session');
  return selected;
}

function selectMasteryTemplates(
  templates: Template[],
  diag: Record<string, any>,
  totalSessions: number
): TemplateSelection[] {
  const selected: TemplateSelection[] = [];
  const used = new Set<string>();
  const byCode = new Map(templates.map(t => [t.template_code, t]));

  const addIf = (code: string, reason: string) => {
    const t = byCode.get(code);
    if (t && !used.has(code) && t.is_active) {
      used.add(code);
      selected.push({
        template_id: t.id, template_code: code, title: t.title,
        session_number: 0, reason, skill_focus: t.skill_dimensions || [],
        difficulty_level: t.difficulty_level,
      });
    }
  };

  // M01 diagnostic already done
  used.add('M01');

  const compEval = diag.comprehension_evaluative;
  const vocabStrategy = diag.vocabulary_strategy;
  const prosody = diag.expression_prosody;
  const grammarAcc = diag.grammar_accuracy;
  const writing = diag.writing_quality;
  const spoken = diag.spoken_english;
  const stamina = diag.reading_stamina_minutes || 0;
  const selfReading = diag.self_selected_reading;

  if (compEval === 'not_yet') {
    addIf('M02', 'Evaluative comprehension not yet — build analytical skills');
    addIf('M07', 'Advanced comprehension after M02');
  }

  if (vocabStrategy === 'guesses' || vocabStrategy === 'skips') {
    addIf('M03', 'Vocabulary strategy needs development');
  }

  if (prosody !== 'engaging') {
    addIf('M04', 'Expression/prosody improvement needed');
  }

  if (grammarAcc === 'weak') {
    addIf('M05', 'Grammar accuracy needs work');
  }

  if (writing === 'sentences' || writing === 'limited') {
    addIf('M05', 'Writing quality needs grammar foundation');
    addIf('M06', 'Extended writing development');
  }

  if (spoken === 'basic' || spoken === 'minimal') {
    addIf('M08', 'Spoken English development');
  }

  if (stamina < 15) {
    addIf('M09', 'Reading stamina below 15 min — build endurance');
  }

  // Self-selected reading — add later after confidence
  if (selfReading === 'avoids_reading') {
    // M11 will be added in fill phase with later ordering
  }

  // Fill remaining
  const available = templates
    .filter(t => !used.has(t.template_code) && t.is_active && !t.is_diagnostic && !t.is_season_finale)
    .sort((a, b) => a.recommended_order - b.recommended_order);

  for (const t of available) {
    if (selected.length >= totalSessions - 2) break;
    const prereqsMet = !t.prerequisites?.length || t.prerequisites.every(p => used.has(p));
    if (prereqsMet) {
      used.add(t.template_code);
      selected.push({
        template_id: t.id, template_code: t.template_code, title: t.title,
        session_number: 0, reason: 'Progressive difficulty fill',
        skill_focus: t.skill_dimensions || [], difficulty_level: t.difficulty_level,
      });
    }
  }

  addIf('M12', 'Season review — always final session');
  return selected;
}

// ============================================================
// Template Sequencing
// ============================================================

export function sequenceTemplates(
  selections: TemplateSelection[],
  templates: Template[]
): TemplateSelection[] {
  const templateMap = new Map(templates.map(t => [t.template_code, t]));

  // Topological sort respecting prerequisites
  const sorted: TemplateSelection[] = [];
  const remaining = [...selections];
  const placed = new Set<string>();

  // Place items whose prereqs are all satisfied
  let maxIter = remaining.length * 2;
  while (remaining.length > 0 && maxIter-- > 0) {
    let placedOne = false;
    for (let i = 0; i < remaining.length; i++) {
      const sel = remaining[i];
      const tmpl = templateMap.get(sel.template_code);
      const prereqs = tmpl?.prerequisites || [];
      const allMet = prereqs.every(p => placed.has(p) || p === 'F01' || p === 'B01' || p === 'M01');

      if (allMet) {
        sorted.push(sel);
        placed.add(sel.template_code);
        remaining.splice(i, 1);
        placedOne = true;
        break;
      }
    }
    if (!placedOne) {
      // Place remaining regardless (broken prereq chain)
      sorted.push(...remaining);
      break;
    }
  }

  // Move finale to last position
  const finaleIdx = sorted.findIndex(s =>
    s.template_code === 'F15' || s.template_code === 'B13' || s.template_code === 'M12'
  );
  if (finaleIdx >= 0 && finaleIdx < sorted.length - 1) {
    const [finale] = sorted.splice(finaleIdx, 1);
    sorted.push(finale);
  }

  // Assign session numbers (session 1 = diagnostic, so start at 2)
  sorted.forEach((s, i) => {
    s.session_number = i + 2;
  });

  return sorted;
}

// ============================================================
// Season Name Generation
// ============================================================

function generateSeasonName(ageBand: string, focusAreas: string[]): string {
  const primaryFocus = focusAreas[0] || '';

  const nameMap: Record<string, Record<string, string>> = {
    foundation: {
      phonemic_awareness: 'Sound Foundations',
      phonics: 'Letter Adventures',
      decoding: 'Word Building',
      fluency: 'Reading Flow',
      vocabulary: 'Word World',
      comprehension: 'Story Explorers',
      confidence: 'Reading Courage',
      default: 'Reading Foundations',
    },
    building: {
      phonics: 'Decoding Mastery',
      fluency: 'Fluency Builders',
      comprehension: 'Story Detectives',
      vocabulary: 'Word Power',
      writing: 'Writing Explorers',
      grammar: 'Language Builders',
      confidence: 'Reading Confidence',
      default: 'Reading Growth',
    },
    mastery: {
      comprehension: 'Critical Readers',
      vocabulary: 'Word Mastery',
      writing: 'Author\'s Journey',
      speaking: 'Voice & Expression',
      grammar: 'Language Precision',
      fluency: 'Reading Excellence',
      confidence: 'Independent Readers',
      default: 'Reading Mastery',
    },
  };

  const bandNames = nameMap[ageBand] || nameMap.building;
  return bandNames[primaryFocus] || bandNames.default;
}

// ============================================================
// Main Entry Point
// ============================================================

export async function generateLearningPlan(
  childId: string,
  diagnosticData: Record<string, any>
): Promise<PlanResult> {
  try {
    const supabase = getSupabase();

    // 1. Get child info
    const { data: child } = await supabase
      .from('children')
      .select('id, age, age_band')
      .eq('id', childId)
      .single();

    if (!child) {
      return { success: false, error: 'Child not found' };
    }

    let ageBand = child.age_band || diagnosticData.age_band;
    if (!ageBand && child.age) {
      if (child.age >= 4 && child.age <= 6) ageBand = 'foundation';
      else if (child.age >= 7 && child.age <= 9) ageBand = 'building';
      else if (child.age >= 10 && child.age <= 12) ageBand = 'mastery';
      else ageBand = 'building';
    }

    // 2. Get active enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, total_sessions, season_number')
      .eq('child_id', childId)
      .in('status', ['active', 'pending_start'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!enrollment) {
      return { success: false, error: 'No active enrollment found' };
    }

    const totalSessions = enrollment.total_sessions || 9;

    // 3. Fetch templates for this age band
    const { data: templates, error: templatesError } = await supabase
      .from('session_templates')
      .select('*')
      .eq('age_band', ageBand)
      .eq('is_active', true)
      .order('recommended_order', { ascending: true });

    if (templatesError || !templates?.length) {
      return { success: false, error: 'No templates found for age band' };
    }

    // 4. Select templates based on diagnostic
    let selections: TemplateSelection[];
    switch (ageBand) {
      case 'foundation':
        selections = selectFoundationTemplates(templates, diagnosticData, totalSessions);
        break;
      case 'mastery':
        selections = selectMasteryTemplates(templates, diagnosticData, totalSessions);
        break;
      default:
        selections = selectBuildingTemplates(templates, diagnosticData, totalSessions);
    }

    // 5. Sequence templates (respecting prerequisites)
    const sequenced = sequenceTemplates(selections, templates);

    // 6. Determine focus areas
    const focusCounts = new Map<string, number>();
    sequenced.forEach(s => {
      s.skill_focus.forEach(skill => {
        focusCounts.set(skill, (focusCounts.get(skill) || 0) + 1);
      });
    });
    const focusAreas = Array.from(focusCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([skill]) => skill);

    // Also consider coach recommended focus
    const coachFocus = diagnosticData.coach_recommended_focus || [];
    if (coachFocus.length > 0 && !focusAreas.includes(coachFocus[0])) {
      focusAreas.unshift(coachFocus[0]);
      if (focusAreas.length > 3) focusAreas.pop();
    }

    const seasonName = generateSeasonName(ageBand, focusAreas);
    const seasonNumber = enrollment.season_number || 1;

    // 7. Create season_roadmaps entry
    const { data: roadmap, error: roadmapError } = await supabase
      .from('season_roadmaps')
      .insert({
        child_id: childId,
        enrollment_id: enrollment.id,
        season_number: seasonNumber,
        age_band: ageBand,
        roadmap_data: {
          season_name: seasonName,
          focus_areas: focusAreas,
          total_planned_sessions: sequenced.length + 1, // +1 for diagnostic
          milestone_description: `Complete ${sequenced.length} sessions focusing on ${focusAreas.slice(0, 2).join(' and ')}`,
          generated_from: 'diagnostic_rules',
          diagnostic_summary: {
            confidence: diagnosticData.confidence_level,
            recommended_focus: diagnosticData.coach_recommended_focus,
            coach_observations: diagnosticData.coach_observations,
          },
        },
        generated_by: 'system',
        status: 'draft',
      })
      .select('id')
      .single();

    if (roadmapError) {
      console.error('Roadmap creation error:', roadmapError.message);
      return { success: false, error: 'Failed to create roadmap' };
    }

    // 8. Create season_learning_plans entries
    const planRows = sequenced.map(sel => ({
      roadmap_id: roadmap.id,
      session_number: sel.session_number,
      session_template_id: sel.template_id,
      focus_area: sel.skill_focus.join(', '),
      objectives: [sel.reason],
      success_criteria: null,
      status: 'planned',
    }));

    if (planRows.length > 0) {
      const { error: planError } = await supabase
        .from('season_learning_plans')
        .insert(planRows);

      if (planError) {
        console.error('Learning plan creation error:', planError.message);
        // Non-fatal — roadmap was created
      }
    }

    // 9. Log decision to learning_events for audit
    await supabase
      .from('learning_events')
      .insert({
        child_id: childId,
        event_type: 'milestone',
        event_date: new Date().toISOString(),
        data: {
          type: 'plan_generated',
          season_name: seasonName,
          season_number: seasonNumber,
          age_band: ageBand,
          focus_areas: focusAreas,
          template_count: sequenced.length,
          selections: sequenced.map(s => ({
            code: s.template_code,
            session: s.session_number,
            reason: s.reason,
          })),
        },
        event_data: {
          type: 'plan_generated',
          roadmap_id: roadmap.id,
          season_name: seasonName,
        },
        content_for_embedding: `Learning plan generated for Season ${seasonNumber}: ${seasonName}. Focus: ${focusAreas.join(', ')}. ${sequenced.length} sessions planned.`,
        created_by: 'system',
      });

    return {
      success: true,
      roadmap_id: roadmap.id,
      plan_items: sequenced,
      season_name: seasonName,
      focus_areas: focusAreas,
    };
  } catch (error: any) {
    console.error('Plan generation error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// Exported helpers for testing
// ============================================================

export { selectFoundationTemplates, selectBuildingTemplates, selectMasteryTemplates };
