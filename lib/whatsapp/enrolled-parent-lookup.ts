// ============================================================
// FILE: lib/whatsapp/enrolled-parent-lookup.ts
// PURPOSE: Detect whether an inbound WhatsApp phone number belongs
//          to a parent with one or more active Yestoryd enrollments.
// Used by:
//   - /api/whatsapp/process (Lead Bot) to skip the lead funnel.
//   - handlers/booking-confirm.ts to avoid creating a duplicate child
//     row when an enrolled parent confirms a slot.
// ============================================================

import { normalizePhone, buildPhoneOrFilter } from '@/lib/utils/phone';
import { createAdminClient } from '@/lib/supabase/admin';

export interface EnrolledChild {
  id: string;
  child_name: string | null;
  name: string | null;
  coachName: string | null;
  enrollmentId: string | null;
}

// ── In-memory TTL cache ───────────────────────────────────────
// Keyed by E.164 phone. Vercel lambdas recycle often, so this is a
// per-instance hot cache — not a shared cache. Acceptable because
// staleness is bounded by TTL and enrollment changes are rare relative
// to inbound message volume.

interface CacheEntry {
  data: EnrolledChild[];
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const CACHE_MAX_ENTRIES = 2000;
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): EnrolledChild[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key: string, data: EnrolledChild[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Evict the oldest insertion (Map preserves insertion order)
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Clear the enrolled-parent cache for a specific phone (E.164). Call after
 * any code path that materially changes enrollment state (new enrollment,
 * cancellation, phone update) so the next lookup re-reads the DB.
 */
export function invalidateEnrolledParentCache(phone?: string): void {
  if (!phone) {
    cache.clear();
    return;
  }
  const normalized = normalizePhone(phone);
  if (normalized) cache.delete(normalized);
}

/**
 * Look up ALL active-enrollment children for a parent phone. Matches all
 * common stored formats (+91…, 91…, 10-digit) via buildPhoneOrFilter.
 * Cached per E.164 phone for 5 min.
 *
 * Returns an empty array if no match OR no active enrollment.
 */
export async function findEnrolledChildrenByPhone(phone: string): Promise<EnrolledChild[]> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return [];

  const cached = cacheGet(normalizedPhone);
  if (cached) return cached;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('children')
    .select(`
      id,
      child_name,
      name,
      enrollments!inner (
        id,
        status,
        coach_id,
        coaches!enrollments_coach_id_fkey ( name )
      )
    `)
    .or(buildPhoneOrFilter('parent_phone', normalizedPhone))
    .eq('enrollments.status', 'active');

  if (error || !data) return [];

  const result: EnrolledChild[] = data.map((row) => {
    const enrollments = Array.isArray(row.enrollments) ? row.enrollments : [];
    const firstEnrollment = enrollments[0];
    const coaches = firstEnrollment?.coaches;
    const coachRow = Array.isArray(coaches) ? coaches[0] : coaches;
    return {
      id: row.id,
      child_name: row.child_name,
      name: row.name,
      coachName: coachRow?.name || null,
      enrollmentId: firstEnrollment?.id || null,
    };
  });

  cacheSet(normalizedPhone, result);
  return result;
}
