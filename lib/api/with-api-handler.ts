// ============================================================
// FILE: lib/api/with-api-handler.ts
// PURPOSE: HOF that wraps API route handlers with auth + error handling
// Eliminates repeated try/catch + auth boilerplate in 100+ routes
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  requireAdmin,
  requireCoach,
  requireAdminOrCoach,
  requireAuth,
  getServiceSupabase,
  type AuthResult,
} from '@/lib/api-auth';
import crypto from 'crypto';

// Return type of getServiceSupabase()
type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

export interface HandlerContext {
  auth: AuthResult;
  supabase: ServiceSupabase;
  requestId: string;
}

type AuthMode = 'admin' | 'coach' | 'adminOrCoach' | 'authenticated' | 'none';

interface HandlerOptions {
  /** Which auth check to run. Default: 'authenticated' */
  auth?: AuthMode;
}

/**
 * Wrap an API route handler with standardized auth + error handling.
 *
 * Usage:
 * ```ts
 * export const GET = withApiHandler(async (req, ctx) => {
 *   const { auth, supabase } = ctx;
 *   const { data } = await supabase.from('coaches').select('*');
 *   return NextResponse.json({ data });
 * }, { auth: 'adminOrCoach' });
 * ```
 */
export function withApiHandler(
  handler: (req: NextRequest, ctx: HandlerContext) => Promise<NextResponse>,
  options?: HandlerOptions,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();

    try {
      // Auth check
      const authMode = options?.auth ?? 'authenticated';
      let auth: AuthResult;

      switch (authMode) {
        case 'admin':
          auth = await requireAdmin();
          break;
        case 'coach':
          auth = await requireCoach();
          break;
        case 'adminOrCoach':
          auth = await requireAdminOrCoach();
          break;
        case 'authenticated':
          auth = await requireAuth();
          break;
        case 'none':
          auth = { authorized: true };
          break;
      }

      if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
      }

      const supabase = getServiceSupabase();
      return await handler(req, { auth, supabase, requestId });
    } catch (error) {
      console.error(JSON.stringify({
        requestId,
        event: 'api_error',
        path: req.nextUrl.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

/**
 * Same as withApiHandler but for dynamic routes with params (e.g. [id]).
 *
 * Usage:
 * ```ts
 * export const GET = withParamsHandler(async (req, params, ctx) => {
 *   const { id } = params;
 *   // ...
 * }, { auth: 'adminOrCoach' });
 * ```
 */
export function withParamsHandler<P extends Record<string, string>>(
  handler: (req: NextRequest, params: P, ctx: HandlerContext) => Promise<NextResponse>,
  options?: HandlerOptions,
) {
  return async (
    req: NextRequest,
    { params: paramsPromise }: { params: Promise<P> },
  ): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();

    try {
      const authMode = options?.auth ?? 'authenticated';
      let auth: AuthResult;

      switch (authMode) {
        case 'admin':
          auth = await requireAdmin();
          break;
        case 'coach':
          auth = await requireCoach();
          break;
        case 'adminOrCoach':
          auth = await requireAdminOrCoach();
          break;
        case 'authenticated':
          auth = await requireAuth();
          break;
        case 'none':
          auth = { authorized: true };
          break;
      }

      if (!auth.authorized) {
        return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
      }

      const resolvedParams = await paramsPromise;
      const supabase = getServiceSupabase();
      return await handler(req, resolvedParams, { auth, supabase, requestId });
    } catch (error) {
      console.error(JSON.stringify({
        requestId,
        event: 'api_error',
        path: req.nextUrl.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
