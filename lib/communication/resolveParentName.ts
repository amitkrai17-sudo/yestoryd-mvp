import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Resolves parent first name for WhatsApp template greeting.
 *
 * Used by parent_tuition_onboarding_v4 (slot 1) and any other
 * parent-greeting template requiring a first-name resolver.
 *
 * Resolution chain (first non-empty wins):
 *   1. parent_name_hint (from tuition_onboarding admin form)
 *   2. children.parent_name (via childId)
 *   3. 'Parent' (final fallback — generic, never empty)
 *
 * Returns ONLY the first name (split on whitespace, take [0]).
 * Empty string is treated as missing.
 *
 * @param parentNameHint  Optional hint from tuition_onboarding row
 * @param childId         Optional UUID for children table lookup
 * @returns First name string, never empty, never null
 */
export async function resolveParentName(
  parentNameHint?: string | null,
  childId?: string | null
): Promise<string> {
  const hint = parentNameHint?.trim();
  if (hint && hint.length > 0) {
    return hint.split(/\s+/)[0];
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
          return name.split(/\s+/)[0];
        }
      }
    } catch {
      // Silent fall-through to step 3
    }
  }

  return 'Parent';
}
