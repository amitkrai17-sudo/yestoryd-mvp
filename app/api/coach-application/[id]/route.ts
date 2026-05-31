// ============================================================
// FILE: app/api/coach-application/[id]/route.ts
// ============================================================
// PUBLIC self-service surface for a coach applicant's own application
// (steps 2 & 3 of the apply flow). Replaces the previous anon-client
// GET/PATCH that (a) leaked admin-review fields and (b) allowed an
// unauthenticated caller to set status/interview_*/reviewed_* on ANY
// application by id (IDOR).
//
// Scope-1 contract:
//   - createAdminClient() (service role, bypasses RLS) so the writes
//     succeed for anonymous applicants (sign-in is optional by design).
//   - GET returns ONLY applicant-safe fields — admin-review fields are
//     never projected to a public caller.
//   - PATCH enforces a server-side field allowlist (forbidden fields are
//     stripped, never trusted from the client) AND a status state-machine
//     limited to self-service forward transitions. Admin-review writes stay
//     exclusively on app/api/admin/coach-applications/[id]/route.ts behind
//     requireAdmin().
//
// IDOR note: with sign-in optional, the only handle is the applicationId
// UUID from the URL. The field+status allowlist is the mitigation — a
// caller can only advance their own application through the applicant
// fields and the started → qualified → ai_assessment_complete ladder; it
// can never set approved/rejected/interview_*/reviewed_* or overwrite
// identity fields.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CoachApplicationUpdate =
  Database['public']['Tables']['coach_applications']['Update'];

// Applicant-safe projection. Admin-review fields (reviewed_by, review_notes,
// rejection_reason, interview_*, google_*) are deliberately excluded.
const PUBLIC_SELECT =
  'id, status, name, email, phone, city, country, qualification_checklist, resume_url, audio_statement_url, audio_duration_seconds, ai_responses, ai_assessment_completed_at';

// Statuses past which an applicant may no longer self-edit.
const TERMINAL_STATUSES = ['approved', 'rejected', 'not_qualified'] as const;

// Allowed self-service forward transitions (current → target). Same-status
// (field-only save) is handled separately and always permitted when the
// current status is non-terminal.
const FORWARD_TRANSITIONS: Record<string, string> = {
  started: 'qualified',
  qualified: 'ai_assessment_complete',
};

// Recursive Json validator so the two Json columns type cleanly (no `any`).
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);

// Server-enforced field allowlist. Anything not declared here is stripped by
// Zod (default behaviour) — forbidden identity / admin-review fields can never
// reach the update statement.
const patchSchema = z.object({
  qualification_checklist: jsonSchema.optional(),
  resume_url: z.string().url().max(1000).nullable().optional(),
  audio_statement_url: z.string().url().max(1000).nullable().optional(),
  audio_duration_seconds: z.number().int().nonnegative().max(86400).nullable().optional(),
  ai_responses: jsonSchema.optional(),
  ai_assessment_completed_at: z.string().max(40).nullable().optional(),
  // status is NOT a free field — it is gated by the state-machine below.
  status: z.string().max(40).optional(),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

// ── GET — applicant-safe read ──
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from('coach_applications')
      .select(PUBLIC_SELECT)
      .eq('id', id)
      .limit(1);

    if (error) {
      console.error(JSON.stringify({ event: 'coach_application_get_error', id, error: error.message }));
      return errorResponse('system_error', 'Could not load the application.', 500);
    }

    const application = data?.[0];
    if (!application) {
      return errorResponse('not_found', 'Application not found.', 404);
    }

    return NextResponse.json({ ok: true, application });
  } catch (err) {
    console.error(JSON.stringify({ event: 'coach_application_get_threw', id, error: String(err) }));
    return errorResponse('system_error', 'Could not load the application.', 500);
  }
}

// ── PATCH — Scope-1 self-service update ──
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // 1. Parse + allowlist-validate body (forbidden keys stripped by Zod).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('invalid_input', 'Invalid JSON body.', 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    console.warn(JSON.stringify({ event: 'coach_application_patch_invalid', id, issues: parsed.error.flatten() }));
    return errorResponse('invalid_input', 'Some fields are invalid.', 400);
  }

  // 2. Load current status (the only guard for a free-text status column).
  const { data: currentRows, error: loadErr } = await supabase
    .from('coach_applications')
    .select('id, status')
    .eq('id', id)
    .limit(1);

  if (loadErr) {
    console.error(JSON.stringify({ event: 'coach_application_patch_load_error', id, error: loadErr.message }));
    return errorResponse('system_error', 'Could not update the application.', 500);
  }

  const current = currentRows?.[0];
  if (!current) {
    return errorResponse('not_found', 'Application not found.', 404);
  }

  const currentStatus = current.status;

  // 3. Reject any edit once the application is terminal.
  if ((TERMINAL_STATUSES as readonly string[]).includes(currentStatus)) {
    return errorResponse('forbidden_transition', 'This application can no longer be edited.', 403);
  }

  // 4. Status state-machine. Only same-status (field-only save) or an allowed
  //    forward transition is permitted.
  const targetStatus = parsed.data.status;
  let isTransition = false;
  if (targetStatus !== undefined && targetStatus !== currentStatus) {
    if (FORWARD_TRANSITIONS[currentStatus] !== targetStatus) {
      return errorResponse(
        'forbidden_transition',
        `Cannot move from "${currentStatus}" to "${targetStatus}".`,
        403,
      );
    }
    isTransition = true;
  }

  // 5. Build the typed update from allowlisted fields only.
  const updateData: CoachApplicationUpdate = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.qualification_checklist !== undefined) updateData.qualification_checklist = parsed.data.qualification_checklist;
  if (parsed.data.resume_url !== undefined) updateData.resume_url = parsed.data.resume_url;
  if (parsed.data.audio_statement_url !== undefined) updateData.audio_statement_url = parsed.data.audio_statement_url;
  if (parsed.data.audio_duration_seconds !== undefined) updateData.audio_duration_seconds = parsed.data.audio_duration_seconds;
  if (parsed.data.ai_responses !== undefined) updateData.ai_responses = parsed.data.ai_responses;
  if (parsed.data.ai_assessment_completed_at !== undefined) updateData.ai_assessment_completed_at = parsed.data.ai_assessment_completed_at;
  if (isTransition && targetStatus !== undefined) updateData.status = targetStatus;

  // 6. Apply, returning the applicant-safe projection.
  const { data: updatedRows, error: updateErr } = await supabase
    .from('coach_applications')
    .update(updateData)
    .eq('id', id)
    .select(PUBLIC_SELECT)
    .limit(1);

  if (updateErr) {
    console.error(JSON.stringify({ event: 'coach_application_patch_error', id, error: updateErr.message }));
    return errorResponse('system_error', 'Could not update the application.', 500);
  }

  const application = updatedRows?.[0];
  if (!application) {
    return errorResponse('not_found', 'Application not found.', 404);
  }

  // 7. Audit log on real transitions only.
  if (isTransition) {
    try {
      await supabase.from('activity_log').insert({
        user_email: 'system',
        user_type: 'system',
        action: 'coach_application_step_saved',
        metadata: {
          application_id: id,
          new_status: targetStatus,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(JSON.stringify({ event: 'coach_application_patch_log_failed', id, error: String(err) }));
      // Non-fatal — the application row is the source of truth.
    }
  }

  return NextResponse.json({ ok: true, application });
}
