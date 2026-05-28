import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Resolves parent FULL name for WhatsApp template greeting.
 *
 * Used by parent_tuition_onboarding_v4 and any other parent-greeting template
 * that needs the canonical full name (Pattern B — DB-declared first_word
 * derivation runs server-side via notify.ts → resolveDerivations).
 *
 * Resolution chain (first non-empty wins):
 *   1. parent_name_hint (from tuition_onboarding admin form)
 *   2. children.parent_name (via childId)
 *   3. 'Parent' (final fallback — generic, never empty)
 *
 * Returns the full parent name (no .split). Pattern B derivation handles
 * first_word at the spine.
 *
 * @param parentNameHint  Optional hint from tuition_onboarding row
 * @param childId         Optional UUID for children table lookup
 * @returns Full name string, never empty, never null
 */
export async function resolveParentFullName(
  parentNameHint?: string | null,
  childId?: string | null
): Promise<string> {
  const hint = parentNameHint?.trim();
  if (hint && hint.length > 0) {
    return hint;
  }

  if (childId) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('children')
        .select('parent_name')
        .eq('id', childId)
        .limit(1)
        .maybeSingle();

      if (!error && data?.parent_name) {
        const name = data.parent_name.trim();
        if (name.length > 0) {
          return name;
        }
      }
    } catch {
      // Silent fall-through to step 3
    }
  }

  return 'Parent';
}
