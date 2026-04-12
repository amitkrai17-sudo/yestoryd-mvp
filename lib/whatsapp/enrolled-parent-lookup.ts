// ============================================================
// FILE: lib/whatsapp/enrolled-parent-lookup.ts
// PURPOSE: Detect whether an inbound WhatsApp phone number belongs
//          to a parent with an active Yestoryd enrollment.
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
 * Look up an active-enrollment child by parent phone in any of the three
 * storage formats we've ever used:
 *   +91XXXXXXXXXX (E.164), 91XXXXXXXXXX (no +), XXXXXXXXXX (10-digit).
 * Returns null if no match OR no active enrollment.
 */
export async function findEnrolledChildByPhone(phone: string): Promise<EnrolledChild | null> {
  const e164 = normalizePhone(phone);
  if (!e164) return null;

  const noPlus = e164.replace(/^\+/, '');
  const digits10 = e164.slice(-10);

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
        coaches ( name )
      )
    `)
    .or(`parent_phone.eq.${e164},parent_phone.eq.${noPlus},parent_phone.eq.${digits10}`)
    .eq('enrollments.status', 'active')
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const enrollments = Array.isArray(data.enrollments) ? data.enrollments : [];
  const firstEnrollment = enrollments[0];
  const coaches = firstEnrollment?.coaches;
  const coachRow = Array.isArray(coaches) ? coaches[0] : coaches;
  const coachName = coachRow?.name || null;

  return {
    id: data.id,
    child_name: data.child_name,
    name: data.name,
    coachName,
    enrollmentId: firstEnrollment?.id || null,
  };
}
