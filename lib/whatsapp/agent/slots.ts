// ============================================================
// Agent 2: Discovery Slot Querying
// Uses the existing /api/scheduling/slots API (multi-coach aggregation)
// 15-minute in-memory cache, invalidated on booking
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type TypedClient = SupabaseClient<Database>;

// All slot times from the scheduling API are IST (Asia/Kolkata).
// Always use the +05:30 offset when constructing Date objects from slot date/time.
const IST_OFFSET = '+05:30';

// ============================================================
// Types
// ============================================================

export interface DiscoverySlot {
  date: string;         // YYYY-MM-DD
  time: string;         // HH:MM
  coachId: string;
  coachName: string;
  displayText: string;  // "Thu Feb 27, 10:00 AM" (max 24 chars for WhatsApp list title)
  slotId: string;       // slot_YYYY-MM-DD_HH:mm_coachId
}

// ============================================================
// Cache (module-level, resets on deploy)
// ============================================================

let cachedSlots: DiscoverySlot[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 15 * 60 * 1000;

export function invalidateSlotCache(): void {
  cachedSlots = null;
  cacheTimestamp = 0;
}

// ============================================================
// Main function
// ============================================================

export async function getAvailableSlots(supabase: TypedClient): Promise<DiscoverySlot[]> {
  const now = Date.now();

  // Return cached slots if fresh (filter out any that became past)
  if (cachedSlots && now - cacheTimestamp < CACHE_TTL_MS) {
    const cutoff = new Date(now + 30 * 60 * 1000); // 30 min buffer
    return cachedSlots.filter(s => new Date(`${s.date}T${s.time}:00${IST_OFFSET}`) > cutoff);
  }

  try {
    // Call the existing scheduling slots API (discovery mode = all coaches aggregated)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      || 'http://localhost:3000';

    const response = await fetch(
      `${baseUrl}/api/scheduling/slots?sessionType=discovery&days=7`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      console.error(JSON.stringify({
        event: 'agent2_slots_api_error',
        status: response.status,
      }));
      return [];
    }

    const data = await response.json();
    if (!data.success || !data.slots?.length) return [];

    // Collect unique coach IDs for name lookup
    const allCoachIds = new Set<string>();
    for (const slot of data.slots) {
      if (slot.available && slot.coachIds) {
        for (const id of slot.coachIds) allCoachIds.add(id);
      }
    }

    // Batch-fetch coach names
    const coachMap = new Map<string, string>();
    if (allCoachIds.size > 0) {
      const { data: coaches } = await supabase
        .from('coaches')
        .select('id, name')
        .in('id', Array.from(allCoachIds));

      for (const c of coaches || []) {
        coachMap.set(c.id, c.name.split(' ')[0]); // First name only
      }
    }

    // Past-slot filter: 30 min buffer so we don't show slots that are about to pass
    const cutoff = new Date(now + 30 * 60 * 1000);

    // Build slot list (max 6 — WhatsApp list limit is 10 rows, 6 is cleaner)
    const slots: DiscoverySlot[] = [];
    let totalAvailable = 0;

    for (const s of data.slots) {
      if (!s.available) continue;
      totalAvailable++;

      // Filter out past/imminent slots
      const slotDateTime = new Date(`${s.date}T${s.time}:00${IST_OFFSET}`);
      if (slotDateTime <= cutoff) continue;

      if (slots.length >= 6) continue; // keep counting totalAvailable

      const coachId = s.coachIds?.[0] || 'unassigned';
      const coachName = coachMap.get(coachId) || 'Coach';

      slots.push({
        date: s.date,
        time: s.time,
        coachId,
        coachName,
        displayText: formatSlotTitle(s.date, s.time),
        slotId: `slot_${s.date}_${s.time}_${coachId}`,
      });
    }

    console.log(JSON.stringify({
      event: 'slots_filtered',
      total: totalAvailable,
      afterFilter: slots.length,
      cutoffIST: cutoff.toISOString(),
    }));

    // Cache
    cachedSlots = slots;
    cacheTimestamp = now;

    return slots;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'agent2_slots_fetch_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    return [];
  }
}

// ============================================================
// Parse a slot ID back to its components
// ============================================================

export function parseSlotId(slotId: string): { date: string; time: string; coachId: string } | null {
  // Format: slot_YYYY-MM-DD_HH:mm_coachId
  const match = slotId.match(/^slot_(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})_(.+)$/);
  if (!match) return null;
  return { date: match[1], time: match[2], coachId: match[3] };
}

// ============================================================
// Format helpers
// ============================================================

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format: "Thu Feb 27, 10:00 AM" — max 21 chars, fits WhatsApp 24-char title limit */
function formatSlotTitle(date: string, time: string): string {
  // Use noon IST to safely derive day-of-week (avoids date-boundary issues)
  const d = new Date(`${date}T12:00:00${IST_OFFSET}`);
  const day = DAYS[d.getUTCDay()];

  // Month and day parsed directly from the IST date string
  const [, mm, dd] = date.split('-').map(Number);
  const month = MONTHS[mm - 1];

  // Time from raw string (already IST)
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${day} ${month} ${dd}, ${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Format for confirmation message: "Thursday, 27 February at 10:00 AM" */
export function formatSlotLong(date: string, time: string): string {
  const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // Use noon IST to safely derive day-of-week
  const d = new Date(`${date}T12:00:00${IST_OFFSET}`);
  const dayName = FULL_DAYS[d.getUTCDay()];

  // Month and day parsed directly from the IST date string
  const [, mm, dd] = date.split('-').map(Number);
  const month = FULL_MONTHS[mm - 1];

  // Time from raw string (already IST)
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${dayName}, ${dd} ${month} at ${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
