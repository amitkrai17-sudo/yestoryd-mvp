// ============================================================================
// UNIFIED SLOTS API - MULTI-COACH SUPPORT
// app/api/scheduling/slots/route.ts
// ============================================================================
//
// This API provides available time slots for:
// - Discovery call booking (/lets-talk) - aggregates ALL coaches
// - Coaching session booking - specific coach
// - Rescheduling existing sessions
//
// Key Features:
// - Multi-coach aggregation for discovery calls (more slots = higher conversion)
// - Time bucket grouping (flight-style UI)
// - Age-based session durations
// - Race condition prevention via holds
//
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  SNAP_TO_GRID_MINUTES: 30,
  BUFFER_MINUTES: 15,
  DEFAULT_DAYS: 14,
  MAX_DAYS: 30,
  
  // System defaults (when coach hasn't configured their schedule)
  DEFAULT_START_HOUR: 9,
  DEFAULT_END_HOUR: 19,
  SUNDAY_OFF: true,
  
  // Time buckets for flight-style UI
  TIME_BUCKETS: [
    { name: 'early_morning', displayName: 'Early Morning', emoji: '🌅', startHour: 6, endHour: 9 },
    { name: 'morning', displayName: 'Morning', emoji: '☀️', startHour: 9, endHour: 12 },
    { name: 'afternoon', displayName: 'Afternoon', emoji: '🌤️', startHour: 12, endHour: 16 },
    { name: 'evening', displayName: 'Evening', emoji: '🌆', startHour: 16, endHour: 20 },
    { name: 'night', displayName: 'Night', emoji: '🌙', startHour: 20, endHour: 22 },
  ],
  
  // Age-based durations
  SESSION_DURATIONS: {
    coaching: [
      { minAge: 4, maxAge: 6, duration: 30 },
      { minAge: 7, maxAge: 9, duration: 45 },
      { minAge: 10, maxAge: 12, duration: 60 },
    ],
    discovery: 30,
    parent_checkin: 30,
    group: 45,
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface TimeSlot {
  date: string;
  time: string;
  datetime: string;
  endTime: string;
  available: boolean;
  bucketName: string;
  coachIds?: string[]; // Which coaches have this slot available
}

interface ScheduleRule {
  id: string;
  coach_id: string;
  rule_type: 'available' | 'unavailable';
  scope: 'weekly' | 'date_specific';
  day_of_week?: number;
  specific_date?: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface Coach {
  id: string;
  name: string;
  email: string;
}

interface TimeBucket {
  name: string;
  displayName: string;
  emoji: string;
  startHour: number;
  endHour: number;
  totalSlots: number;
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const coachId = searchParams.get('coachId');
    const days = Math.min(
      parseInt(searchParams.get('days') || String(CONFIG.DEFAULT_DAYS)),
      CONFIG.MAX_DAYS
    );
    const sessionType = (searchParams.get('sessionType') || 'discovery') as 'discovery' | 'coaching' | 'parent_checkin' | 'group';
    const childAge = searchParams.get('childAge') ? parseInt(searchParams.get('childAge')!) : undefined;
    
    console.log(`[Slots API] Request: coachId=${coachId || 'ALL'}, days=${days}, type=${sessionType}, age=${childAge ?? 'undefined'}`);
    
    // ========================================================================
    // STEP 1: Determine which coaches to fetch slots for
    // ========================================================================
    
    let coaches: Coach[] = [];
    
    if (coachId) {
      // Specific coach requested (for coaching sessions, rescheduling)
      const { data: coach } = await supabase
        .from('coaches')
        .select('id, name, email')
        .eq('id', coachId)
        .eq('is_active', true)
        .single();
      
      if (coach) {
        coaches = [coach];
      }
    } else {
      // No specific coach - get ALL active coaches (for discovery calls)
      const { data: activeCoaches } = await supabase
        .from('coaches')
        .select('id, name, email')
        .eq('is_active', true)
        .eq('is_available', true)
        .is('exit_status', null);
      
      coaches = activeCoaches || [];
    }
    
    if (coaches.length === 0) {
      return NextResponse.json({
        success: true,
        slots: [],
        slotsByBucket: CONFIG.TIME_BUCKETS.map(b => ({ ...b, totalSlots: 0 })),
        slotsByDate: {},
        summary: {
          totalSlots: 0,
          totalAvailable: 0,
          coaches: 0,
        },
        message: 'No coaches available',
      });
    }
    
    // ========================================================================
    // STEP 2: Get schedule rules for all coaches
    // ========================================================================
    
    const coachIds = coaches.map(c => c.id);
    
    const { data: rules } = await supabase
      .from('coach_schedule_rules')
      .select('*')
      .in('coach_id', coachIds)
      .eq('is_active', true);
    
    // ========================================================================
    // STEP 3: Get existing bookings to exclude
    // ========================================================================
    
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);
    
    const { data: existingBookings } = await supabase
      .from('scheduled_sessions')
      .select('coach_id, scheduled_date, scheduled_time')
      .in('coach_id', coachIds)
      .gte('scheduled_date', startDate.toISOString().split('T')[0])
      .lte('scheduled_date', endDate.toISOString().split('T')[0])
      .in('status', ['scheduled', 'confirmed']);
    
    // Also get discovery calls
    const { data: discoveryBookings } = await supabase
      .from('discovery_calls')
      .select('assigned_coach_id, slot_date, slot_time')
      .in('assigned_coach_id', coachIds)
      .gte('slot_date', startDate.toISOString().split('T')[0])
      .lte('slot_date', endDate.toISOString().split('T')[0])
      .in('status', ['scheduled', 'confirmed']);
    
    // Get active holds
    const { data: activeHolds } = await supabase
      .from('session_holds')
      .select('coach_id, slot_date, slot_time')
      .in('coach_id', coachIds)
      .gt('expires_at', new Date().toISOString());
    
    // Create blocked slots map: Map<coachId-date-time, true>
    // Normalize time to HH:MM format (database may store HH:MM:SS)
    const normalizeTime = (time: string): string => {
      if (!time) return '';
      return time.substring(0, 5); // Take only HH:MM
    };

    const blockedSlots = new Map<string, boolean>();

    existingBookings?.forEach(b => {
      const normalizedTime = normalizeTime(b.scheduled_time);
      blockedSlots.set(`${b.coach_id}-${b.scheduled_date}-${normalizedTime}`, true);
    });

    discoveryBookings?.forEach(b => {
      if (b.assigned_coach_id && b.slot_date && b.slot_time) {
        const normalizedTime = normalizeTime(b.slot_time);
        blockedSlots.set(`${b.assigned_coach_id}-${b.slot_date}-${normalizedTime}`, true);
      }
    });

    activeHolds?.forEach(h => {
      const normalizedTime = normalizeTime(h.slot_time);
      blockedSlots.set(`${h.coach_id}-${h.slot_date}-${normalizedTime}`, true);
    });
    
    // ========================================================================
    // STEP 4: Calculate session duration
    // ========================================================================
    
    let durationMinutes: number;

    if (sessionType === 'coaching') {
      if (childAge) {
        // Age-based duration for coaching
        const durationRule = CONFIG.SESSION_DURATIONS.coaching.find(
          r => childAge >= r.minAge && childAge <= r.maxAge
        );
        durationMinutes = durationRule?.duration || 45;
      } else {
        // Default coaching duration when age not provided (e.g., reschedule)
        durationMinutes = 45;
      }
    } else {
      // Non-coaching session types have fixed durations
      const duration = CONFIG.SESSION_DURATIONS[sessionType];
      durationMinutes = typeof duration === 'number' ? duration : 30;
    }
    
    // ========================================================================
    // STEP 5: Generate slots for each coach, then aggregate
    // ========================================================================

    // DEBUG: Log rules breakdown
    console.log('=== SLOT GENERATION DEBUG ===');
    console.log('Date range:', startDate.toISOString().split('T')[0], 'to', new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    console.log('Duration minutes:', durationMinutes);
    console.log('Total rules fetched:', rules?.length || 0);

    if (rules && rules.length > 0) {
      const weeklyAvailable = rules.filter(r => r.scope === 'weekly' && r.rule_type === 'available');
      const dateUnavailable = rules.filter(r => r.scope === 'date_specific' && r.rule_type === 'unavailable');
      console.log('Weekly available rules:', weeklyAvailable.length);
      console.log('Date-specific unavailable:', dateUnavailable.length);

      // Show which days have rules
      const daysCovered = new Set(weeklyAvailable.map(r => r.day_of_week));
      console.log('Days with availability rules (0=Sun, 1=Mon...):', Array.from(daysCovered).sort());

      // Sample rules
      weeklyAvailable.slice(0, 3).forEach((r, i) => {
        console.log(`  Rule ${i}: day=${r.day_of_week}, ${r.start_time}-${r.end_time}, active=${r.is_active}`);
      });
    }

    // Map to track slots: Map<datetime, { slot, coachIds[] }>
    const slotMap = new Map<string, { slot: TimeSlot; coachIds: string[] }>();

    for (const coach of coaches) {
      const coachRules = (rules || []).filter(r => r.coach_id === coach.id);
      console.log(`Coach ${coach.id}: ${coachRules.length} rules`);

      const coachSlots = generateSlotsForCoach(
        coach.id,
        coachRules,
        startDate,
        days,
        durationMinutes,
        blockedSlots
      );

      console.log(`Coach ${coach.id}: generated ${coachSlots.length} total slots, ${coachSlots.filter(s => s.available).length} available`);

      // Merge into aggregate map
      for (const slot of coachSlots) {
        if (!slot.available) continue;

        const key = slot.datetime;
        if (slotMap.has(key)) {
          slotMap.get(key)!.coachIds.push(coach.id);
        } else {
          slotMap.set(key, {
            slot: { ...slot, coachIds: [coach.id] },
            coachIds: [coach.id],
          });
        }
      }
    }

    console.log('=== END DEBUG ===')
    
    // Convert to array
    const aggregatedSlots: TimeSlot[] = Array.from(slotMap.values())
      .map(entry => ({
        ...entry.slot,
        coachIds: entry.coachIds,
        available: true,
      }))
      .sort((a, b) => a.datetime.localeCompare(b.datetime));
    
    // ========================================================================
    // STEP 6: Organize by bucket and date
    // ========================================================================
    
    const slotsByBucket: TimeBucket[] = CONFIG.TIME_BUCKETS.map(bucket => ({
      ...bucket,
      totalSlots: aggregatedSlots.filter(s => s.bucketName === bucket.name).length,
    }));
    
    const slotsByDate: Record<string, TimeSlot[]> = {};
    for (const slot of aggregatedSlots) {
      if (!slotsByDate[slot.date]) {
        slotsByDate[slot.date] = [];
      }
      slotsByDate[slot.date].push(slot);
    }
    
    // Find recommended bucket
    const recommendedBucket = slotsByBucket
      .filter(b => b.totalSlots > 0)
      .sort((a, b) => b.totalSlots - a.totalSlots)[0]?.name || '';
    
    // ========================================================================
    // STEP 7: Return response
    // ========================================================================
    
    const execTime = Date.now() - startTime;
    console.log(`[Slots API] Generated ${aggregatedSlots.length} slots from ${coaches.length} coach(es), rules=${rules?.length || 0}, blocked=${blockedSlots.size}, ${execTime}ms`);
    
    return NextResponse.json({
      success: true,
      slots: aggregatedSlots,
      slotsByBucket,
      slotsByDate,
      durationMinutes,
      summary: {
        totalSlots: aggregatedSlots.length,
        totalAvailable: aggregatedSlots.length,
        coaches: coaches.length,
        recommendedBucket,
        rulesCount: rules?.length || 0,
        execTimeMs: execTime,
      },
    });
    
  } catch (error: any) {
    console.error('[Slots API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch slots' },
      { status: 500 }
    );
  }
}

// ============================================================================
// SLOT GENERATION FOR SINGLE COACH
// ============================================================================

function generateSlotsForCoach(
  coachId: string,
  rules: ScheduleRule[],
  startDate: Date,
  days: number,
  durationMinutes: number,
  blockedSlots: Map<string, boolean>
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  // Separate rules by type
  const weeklyRules = rules.filter(r => r.scope === 'weekly' && r.rule_type === 'available');
  const dateSpecificUnavailable = rules.filter(r => r.scope === 'date_specific' && r.rule_type === 'unavailable');

  // Check if coach has ANY weekly rules configured
  const hasConfiguredSchedule = weeklyRules.length > 0;

  // DEBUG: Log day_of_week values in rules
  const ruleDays = weeklyRules.map(r => r.day_of_week).filter((d): d is number => d !== undefined);
  const uniqueDays = Array.from(new Set(ruleDays)).sort((a, b) => a - b);
  console.log(`[generateSlots] Coach has ${weeklyRules.length} weekly rules for days: ${uniqueDays.join(', ')}`);

  let daysProcessed = 0;
  let daysSkippedSunday = 0;
  let daysSkippedBlocked = 0;
  let daysSkippedNoRules = 0;
  let daysWithRules = 0;

  // Generate for each day
  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);

    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay(); // JS: 0=Sunday, 1=Monday, etc.

    daysProcessed++;

    // Check if this date is specifically blocked
    const isDateBlocked = dateSpecificUnavailable.some(r => r.specific_date === dateStr);
    if (isDateBlocked) {
      daysSkippedBlocked++;
      continue;
    }

    // Skip Sundays if config says so
    if (CONFIG.SUNDAY_OFF && dayOfWeek === 0) {
      daysSkippedSunday++;
      continue;
    }

    // Get rules for this day - try both JS format (0=Sun) and ISO format (1=Mon, 7=Sun)
    let dayRules = weeklyRules.filter(r => r.day_of_week === dayOfWeek);

    // If no match, try ISO-8601 format where Monday=1, Sunday=7
    if (dayRules.length === 0 && hasConfiguredSchedule) {
      const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert: Sun=0->7, Mon=1->1, etc.
      dayRules = weeklyRules.filter(r => r.day_of_week === isoDayOfWeek);
      if (dayRules.length > 0) {
        console.log(`[generateSlots] Using ISO day format: JS day ${dayOfWeek} -> ISO day ${isoDayOfWeek}, found ${dayRules.length} rules`);
      }
    }

    // If coach has configured schedule but no rules for this day, skip (coach is off)
    // If coach has NO configured schedule, use default availability
    if (hasConfiguredSchedule && dayRules.length === 0) {
      daysSkippedNoRules++;
      continue;
    }

    if (dayRules.length > 0) {
      daysWithRules++;
      // Generate slots from each configured rule
      for (const rule of dayRules) {
        const ruleSlots = generateSlotsFromRule(
          coachId,
          rule,
          dateStr,
          durationMinutes,
          blockedSlots
        );
        slots.push(...ruleSlots);
      }
    } else {
      // No rules configured - use default availability (9 AM - 7 PM)
      const defaultRule: ScheduleRule = {
        id: 'default',
        coach_id: coachId,
        rule_type: 'available',
        scope: 'weekly',
        day_of_week: dayOfWeek,
        start_time: `${String(CONFIG.DEFAULT_START_HOUR).padStart(2, '0')}:00`,
        end_time: `${String(CONFIG.DEFAULT_END_HOUR).padStart(2, '0')}:00`,
        is_active: true,
      };

      const defaultSlots = generateSlotsFromRule(
        coachId,
        defaultRule,
        dateStr,
        durationMinutes,
        blockedSlots
      );
      slots.push(...defaultSlots);
    }
  }

  console.log(`[generateSlots] Days: processed=${daysProcessed}, withRules=${daysWithRules}, skipped(sun=${daysSkippedSunday}, blocked=${daysSkippedBlocked}, noRules=${daysSkippedNoRules})`);

  return slots;
}

// ============================================================================
// GENERATE SLOTS FROM A SINGLE RULE
// ============================================================================

function generateSlotsFromRule(
  coachId: string,
  rule: ScheduleRule,
  dateStr: string,
  durationMinutes: number,
  blockedSlots: Map<string, boolean>
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  // Parse time - handle both "HH:MM" and "HH:MM:SS" formats
  const parseTime = (timeStr: string): [number, number] => {
    const parts = timeStr.split(':').map(Number);
    return [parts[0] || 0, parts[1] || 0];
  };

  const [startHour, startMin] = parseTime(rule.start_time);
  const [endHour, endMin] = parseTime(rule.end_time);

  const ruleStartMinutes = startHour * 60 + startMin;
  const ruleEndMinutes = endHour * 60 + endMin;

  // Snap start time to grid
  let currentMinutes = Math.ceil(ruleStartMinutes / CONFIG.SNAP_TO_GRID_MINUTES) * CONFIG.SNAP_TO_GRID_MINUTES;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  let slotsGenerated = 0;
  let slotsSkippedPast = 0;
  let slotsBlocked = 0;

  while (currentMinutes + durationMinutes <= ruleEndMinutes) {
    const slotHour = Math.floor(currentMinutes / 60);
    const slotMin = currentMinutes % 60;
    const timeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

    // Skip if in the past (with 30 min buffer)
    if (dateStr === todayStr && currentMinutes <= currentTimeMinutes + 30) {
      slotsSkippedPast++;
      currentMinutes += CONFIG.SNAP_TO_GRID_MINUTES;
      continue;
    }

    // Check if blocked
    const blockKey = `${coachId}-${dateStr}-${timeStr}`;
    const isBlocked = blockedSlots.has(blockKey);
    if (isBlocked) slotsBlocked++;

    // Calculate end time
    const endMinutes = currentMinutes + durationMinutes;
    const endHourCalc = Math.floor(endMinutes / 60);
    const endMinCalc = endMinutes % 60;
    const endTimeStr = `${String(endHourCalc).padStart(2, '0')}:${String(endMinCalc).padStart(2, '0')}`;

    // Determine bucket
    const bucketName = getBucketName(slotHour);

    slots.push({
      date: dateStr,
      time: timeStr,
      datetime: `${dateStr}T${timeStr}`,
      endTime: endTimeStr,
      available: !isBlocked,
      bucketName,
    });

    slotsGenerated++;

    // Move to next slot (with buffer)
    currentMinutes += CONFIG.SNAP_TO_GRID_MINUTES;
  }

  // Debug output for first rule only to avoid spam
  if (slots.length === 0 || rule.id === 'default') {
    console.log(`[generateSlotsFromRule] ${dateStr}: rule ${rule.start_time}-${rule.end_time}, generated=${slotsGenerated}, skippedPast=${slotsSkippedPast}, blocked=${slotsBlocked}`);
  }

  return slots;
}

// ============================================================================
// HELPERS
// ============================================================================

function getBucketName(hour: number): string {
  for (const bucket of CONFIG.TIME_BUCKETS) {
    if (hour >= bucket.startHour && hour < bucket.endHour) {
      return bucket.name;
    }
  }
  return 'evening';
}
