// ============================================================
// FILE: app/api/coach-application/[id]/upload-url/route.ts
// ============================================================
// Server-authorized signed upload URL for a coach applicant's resume or
// voice statement. Lets the 2E client upload to the (authenticated-only)
// 'coach-applications' bucket WITHOUT opening it to anon writes: the server
// (service role) mints a one-shot signed upload token scoped to a single
// path it controls.
//
// Flow (client side, 2E):
//   POST here → { path, token, signedUrl, publicUrl }
//   → supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file)
//   → PATCH /api/coach-application/[id] with resume_url|audio_statement_url = publicUrl
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'coach-applications';

// Statuses past which an applicant may no longer upload (mirrors the PATCH guard).
const TERMINAL_STATUSES = ['approved', 'rejected', 'not_qualified'] as const;

// Allowed contentType → file extension, per upload kind.
const ALLOWED: Record<'resume' | 'audio', Record<string, string>> = {
  resume: {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  },
  audio: {
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
  },
};

const uploadSchema = z.object({
  kind: z.enum(['resume', 'audio']),
  contentType: z.string().min(1).max(100),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // 1. Parse + validate body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('invalid_input', 'Invalid JSON body.', 400);
  }

  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('invalid_input', 'kind and contentType are required.', 400);
  }

  const { kind, contentType } = parsed.data;

  // 2. Constrain contentType by kind.
  const ext = ALLOWED[kind][contentType];
  if (!ext) {
    return errorResponse('invalid_input', `Unsupported file type for ${kind}.`, 400);
  }

  // 3. Load the application; gate on existence + non-terminal status.
  const { data: rows, error: loadErr } = await supabase
    .from('coach_applications')
    .select('id, status')
    .eq('id', id)
    .limit(1);

  if (loadErr) {
    console.error(JSON.stringify({ event: 'coach_application_upload_load_error', id, error: loadErr.message }));
    return errorResponse('system_error', 'Could not prepare the upload.', 500);
  }

  const application = rows?.[0];
  if (!application) {
    return errorResponse('not_found', 'Application not found.', 404);
  }

  if ((TERMINAL_STATUSES as readonly string[]).includes(application.status)) {
    return errorResponse('forbidden_transition', 'This application can no longer be edited.', 403);
  }

  // 4. Scoped, id-namespaced path.
  const path = `${id}/${kind}-${Date.now()}.${ext}`;

  // 5. Mint the signed upload token (service role).
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (signErr || !signed) {
    console.error(JSON.stringify({ event: 'coach_application_upload_sign_error', id, error: signErr?.message ?? 'no data' }));
    return errorResponse('system_error', 'Could not prepare the upload.', 500);
  }

  // 6. Public-read URL the client will persist after uploading.
  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    ok: true,
    path: signed.path,
    token: signed.token,
    signedUrl: signed.signedUrl,
    publicUrl: publicData.publicUrl,
  });
}
