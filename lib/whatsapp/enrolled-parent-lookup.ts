// ============================================================
// FILE: lib/whatsapp/enrolled-parent-lookup.ts
// PURPOSE: Detect whether an inbound WhatsApp phone number belongs
//          to a parent with one or more active Yestoryd enrollments.
// Used by:
//   - /api/whatsapp/process (Lead Bot) to skip the lead funnel.
//   - handlers/booking-confirm.ts to avoid creating a duplicate child
//     row when an enrolled parent confirms a slot.
// ============================================================

import { normalizePhone } from '@/lib/utils/phone';
import { createAdminClient } from '@/lib/supabase/admin';

export interface EnrolledChild {
  id: string;
  child_name: string | null;
  name: string | null;
  coachName: string | null;
  enrollmentId: string | null;
}

/**
 * Look up ALL active-enrollment children for a parent phone. Mirrors the
 * phone match pattern used in auth routes (send-otp, verify-otp,
 * middleware) plus an explicit +91<10-digit> reconstruction to cover
 * inputs that weren't cleanly normalized upstream.
 *
 * Formats matched:
 *   +919687606177 (E.164, normalizedPhone)
 *   919687606177  (no +, normalizedPhone.slice(1))
 *   9687606177    (10-digit, normalizedPhone.slice(3))
 *   +919687606177 reconstructed as `+91${digits10}` (defensive)
 *
 * Returns an empty array if no match OR no active enrollment.
 */
export async function findEnrolledChildrenByPhone(phone: string): Promise<EnrolledChild[]> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return [];

  const digits10 = normalizedPhone.slice(3);
  const plus91Reconstructed = `+91${digits10}`;

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
    .or(`parent_phone.eq.${normalizedPhone},parent_phone.eq.${normalizedPhone.slice(1)},parent_phone.eq.${normalizedPhone.slice(3)},parent_phone.eq.${plus91Reconstructed}`)
    .eq('enrollments.status', 'active');

  if (error || !data) return [];

  return data.map((row) => {
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
}
