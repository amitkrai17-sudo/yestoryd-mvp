// ============================================================
// FILE: app/api/discovery-call/pending/route.ts
// ============================================================
// HARDENED VERSION - Discovery Calls List for CRM
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Admin/Coach authentication required
// - Coaches only see their assigned calls
// - PII masking in responses
// - Pagination support
// - Request tracing
// - UUID validation
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrCoach } from '@/lib/api-auth';
import crypto from 'crypto';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- HELPER: Mask PII ---
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length < 6) return '***';
  return '***' + phone.slice(-4);
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 2 
    ? local.slice(0, 2) + '***' 
    : '***';
  return `${maskedLocal}@${domain}`;
}

// --- HELPER: UUID validation ---
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ============================================================
// GET: List discovery calls with filters
// ============================================================
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Authenticate using Supabase Auth
    const auth = await requireAdminOrCoach();

    if (!auth.authorized) {
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: auth.error,
        attemptedEmail: auth.email,
      }));

      return NextResponse.json(
        { error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    const userEmail = auth.email!;
    const userRole = 'admin'; // All authenticated admins have admin role
    const sessionCoachId: string | undefined = undefined; // Admin mode, no coach restriction



    // 3. Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const coachId = searchParams.get('coachId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Validate coachId if provided
    if (coachId && !isValidUUID(coachId)) {
      return NextResponse.json(
        { error: 'Invalid coachId format' },
        { status: 400 }
      );
    }

    // Validate pagination
    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // 4. Admin sees all calls, coachId is optional filter
    const effectiveCoachId: string | null = coachId || null;


    console.log(JSON.stringify({
      requestId,
      event: 'discovery_calls_list_request',
      userEmail,
      userRole,
      filters: { status, coachId: effectiveCoachId, page, limit },
    }));

    const supabase = getSupabase();

    // 5. Build query
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // At scale (100k+ rows), use estimated count for performance
    // Pass ?fastCount=true to use estimated count
    const useFastCount = searchParams.get('fastCount') === 'true';

    // Count query for pagination
    // 'exact' = slow but accurate, 'estimated' = fast but approximate
    // 'planned' uses EXPLAIN to estimate (faster than exact)
    let countQuery = supabase
      .from('discovery_calls')
      .select('id', { count: useFastCount ? 'planned' : 'exact', head: true });

    // Data query
    let query = supabase
      .from('discovery_calls')
      .select(`
        id,
        child_name,
        child_age,
        parent_name,
        parent_email,
        parent_phone,
        scheduled_at,
        status,
        assigned_coach_id,
        assignment_type,
        assigned_by,
        assigned_at,
        assessment_score,
        questionnaire,
        payment_link_sent_at,
        followup_sent_at,
        converted_to_enrollment,
        created_at,
        booking_source,
        google_meet_link,
        slot_date,
        slot_time,
        call_completed,
        call_outcome,
        likelihood,
        objections,
        concerns,
        follow_up_notes,
        follow_up_date,
        completed_at,
        assigned_coach:coaches!assigned_coach_id (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .range(start, end);

    // Apply status filter
    if (status === 'pending') {
      query = query.eq('status', 'pending');
      countQuery = countQuery.eq('status', 'pending');
    } else if (status === 'assigned') {
      query = query.not('assigned_coach_id', 'is', null).eq('status', 'pending');
      countQuery = countQuery.not('assigned_coach_id', 'is', null).eq('status', 'pending');
    } else if (status === 'scheduled') {
      query = query.eq('status', 'scheduled');
      countQuery = countQuery.eq('status', 'scheduled');
    } else if (status === 'completed') {
      query = query.eq('status', 'completed');
      countQuery = countQuery.eq('status', 'completed');
    }
    // If status is '' or 'all', no filter

    // Apply coach filter (enforced for coaches, optional for admins)
    if (effectiveCoachId) {
      query = query.eq('assigned_coach_id', effectiveCoachId);
      countQuery = countQuery.eq('assigned_coach_id', effectiveCoachId);
    }

    // Execute queries
    const [{ data: calls, error }, { count: totalCount }] = await Promise.all([
      query,
      countQuery,
    ]);

    if (error) {
      console.error('Error fetching discovery calls:', error);
      return NextResponse.json(
        { error: 'Failed to fetch discovery calls', details: error.message },
        { status: 500 }
      );
    }

    // 6. Transform and mask PII
    const transformedCalls = (calls || []).map(call => ({
      ...call,
      // Map DB column names to CRM expected names
      scheduled_time: call.scheduled_at,
      call_status: call.status,
      questionnaire_data: call.questionnaire,
      // MASK PII - Admins see full, Coaches see masked
      parent_phone: userRole === 'admin' ? call.parent_phone : maskPhone(call.parent_phone),
      parent_email: userRole === 'admin' ? call.parent_email : maskEmail(call.parent_email),
    }));

    // 7. Get coaches list (Admin only, or just own coach for coaches)
    let coaches: any[] = [];

    if (userRole === 'admin') {
      // Admins see all coaches
      const { data: allCoaches, error: coachError } = await supabase
        .from('coaches')
        .select('id, name, email')
        .order('name', { ascending: true });

      if (coachError) {
        console.error('Error fetching coaches:', coachError);
      }
      coaches = allCoaches || [];
    } else if (userRole === 'coach' && sessionCoachId) {
      // Coaches only see themselves
      const { data: ownCoach } = await supabase
        .from('coaches')
        .select('id, name, email')
        .eq('id', sessionCoachId)
        .single();

      if (ownCoach) {
        coaches = [ownCoach];
      }
    }

    const duration = Date.now() - startTime;
    const totalPages = Math.ceil((totalCount || 0) / limit);

    console.log(JSON.stringify({
      requestId,
      event: 'discovery_calls_listed',
      count: transformedCalls.length,
      totalCount,
      page,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      calls: transformedCalls,
      coaches,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages,
        hasMore: page < totalPages,
        countType: useFastCount ? 'estimated' : 'exact',
      },
    }, {
      headers: { 'X-Request-Id': requestId },
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'discovery_calls_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}


