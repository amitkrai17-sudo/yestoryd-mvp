// =============================================================================
// FILE: app/parent/assessment/[childId]/route.ts
// PURPOSE: Public 307 redirect → /parent/intelligence/<childId>.
//          Wired to the URL button on parent_assessment_results_v3.
//
// URL shape: GET /parent/assessment/<childId>
//   - childId is the children.id UUID v4 (caller's contextId at
//     app/api/assessment/analyze/route.ts:727 passes the same value).
//   - When the UUID is well-formed → 307 redirect to /parent/intelligence/<childId>
//     (existing parent page; login-gated server-side).
//   - Otherwise → 307 fallback to /parent/sessions (login-gated dashboard).
//
// No auth at the redirect surface — both destinations enforce auth themselves.
// Mirrors app/j/[sessionId]/route.ts structurally.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FALLBACK_PATH = '/parent/sessions';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  const { childId } = await params;

  if (!childId || !UUID_RE.test(childId)) {
    return NextResponse.redirect(new URL(FALLBACK_PATH, request.url), 307);
  }

  return NextResponse.redirect(
    new URL(`/parent/intelligence/${childId}`, request.url),
    307,
  );
}
