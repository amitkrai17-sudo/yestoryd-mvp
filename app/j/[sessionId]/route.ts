// =============================================================================
// FILE: app/j/[sessionId]/route.ts
// PURPOSE: Public 307 redirect → scheduled_sessions.google_meet_link.
//          Wired to the URL button on parent_session_reminder_1h_online_v1
//          (Meta-approved template, currently UNDER REVIEW). Inert until that
//          template is Active + the 1h cron's ONLINE_1H_TEMPLATE_LIVE flag flips
//          to true — harmless to ship beforehand.
//
// URL shape: GET /j/<sessionId>
//   - sessionId is a UUID v4 from scheduled_sessions.id
//   - When session exists, status='scheduled', session_mode='online', and
//     google_meet_link is populated → 307 redirect to the Meet link.
//   - Otherwise → 307 fallback to /parent/sessions (login-gated dashboard).
//
// No auth required at the redirect surface (the Meet link itself is the
// access gate). The fallback page is login-gated server-side.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const FALLBACK_PATH = '/parent/sessions';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const fallbackUrl = new URL(FALLBACK_PATH, request.url);

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return NextResponse.redirect(fallbackUrl, 307);
  }

  try {
    const supabase = createAdminClient();
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('google_meet_link, session_mode, status')
      .eq('id', sessionId)
      .maybeSingle();

    if (
      session &&
      session.status === 'scheduled' &&
      session.session_mode === 'online' &&
      session.google_meet_link
    ) {
      return NextResponse.redirect(session.google_meet_link, 307);
    }
  } catch {
    // Fall through to fallback — DB error should never block parent click.
  }

  return NextResponse.redirect(fallbackUrl, 307);
}
