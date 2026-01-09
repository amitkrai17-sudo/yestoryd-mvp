// ============================================================
// FILE: lib/auth.ts
// ============================================================
// Authentication helpers for API route protection
// Yestoryd - AI-Powered Reading Intelligence Platform
// ============================================================

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';

// --- TYPES ---
export type UserRole = 'admin' | 'coach' | 'parent' | 'unknown';

export interface AuthenticatedUser {
  id?: string;
  email: string;
  name?: string;
  role: UserRole;
  coachId?: string;
  parentId?: string;
}

export interface AuthResult {
  authenticated: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

// --- MAIN AUTH CHECK ---

/**
 * Get authenticated user from session
 * Use in API routes to check authentication
 */
export async function getAuthUser(): Promise<AuthResult> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return { authenticated: false, error: 'Not authenticated' };
    }

    return {
      authenticated: true,
      user: {
        id: (session.user as any).id,
        email: session.user.email,
        name: session.user.name || undefined,
        role: (session.user as any).role || 'unknown',
        coachId: (session.user as any).coachId,
        parentId: (session.user as any).parentId,
      },
    };
  } catch (error) {
    console.error('Auth check error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}

// --- ROLE CHECKS ---

/**
 * Check if user is admin
 */
export async function requireAdmin(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const auth = await getAuthUser();

  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (auth.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
  }

  return { user: auth.user };
}

/**
 * Check if user is admin or coach
 */
export async function requireAdminOrCoach(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const auth = await getAuthUser();

  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (auth.user.role !== 'admin' && auth.user.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden - Admin or Coach access required' }, { status: 403 });
  }

  return { user: auth.user };
}

/**
 * Check if user is authenticated (any role)
 */
export async function requireAuth(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const auth = await getAuthUser();

  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return { user: auth.user };
}

/**
 * Check if coach owns the resource
 */
export async function requireCoachOwnership(
  resourceCoachId: string | null | undefined
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const auth = await getAuthUser();

  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admins can access anything
  if (auth.user.role === 'admin') {
    return { user: auth.user };
  }

  // Coaches can only access their own resources
  if (auth.user.role === 'coach') {
    if (!resourceCoachId || auth.user.coachId !== resourceCoachId) {
      return NextResponse.json({ error: 'Forbidden - Not your resource' }, { status: 403 });
    }
    return { user: auth.user };
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * Check if parent owns the child resource
 */
export async function requireParentOwnership(
  resourceParentId: string | null | undefined
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const auth = await getAuthUser();

  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admins can access anything
  if (auth.user.role === 'admin') {
    return { user: auth.user };
  }

  // Coaches can access their assigned children's parents
  if (auth.user.role === 'coach') {
    // For now, allow coaches to access - you may want to add more checks
    return { user: auth.user };
  }

  // Parents can only access their own data
  if (auth.user.role === 'parent') {
    if (!resourceParentId || auth.user.parentId !== resourceParentId) {
      return NextResponse.json({ error: 'Forbidden - Not your resource' }, { status: 403 });
    }
    return { user: auth.user };
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// --- UTILITY FUNCTIONS ---

/**
 * Check if result is an error response
 */
export function isAuthError(result: { user: AuthenticatedUser } | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Wrapper for protected API routes
 * 
 * Usage:
 * export async function GET(request: NextRequest) {
 *   return withAuth(request, ['admin', 'coach'], async (user) => {
 *     // Your handler code here
 *     return NextResponse.json({ data: 'protected data' });
 *   });
 * }
 */
export async function withAuth(
  request: NextRequest,
  allowedRoles: UserRole[],
  handler: (user: AuthenticatedUser, request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await getAuthUser();

  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Please sign in to access this resource' },
      { status: 401 }
    );
  }

  if (!allowedRoles.includes(auth.user.role)) {
    return NextResponse.json(
      { error: 'Forbidden', message: `This resource requires one of: ${allowedRoles.join(', ')}` },
      { status: 403 }
    );
  }

  return handler(auth.user, request);
}

// --- TYPE AUGMENTATION ---
// Add to your next-auth.d.ts or types/next-auth.d.ts

/*
import NextAuth, { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      role?: 'admin' | 'coach' | 'parent' | 'unknown';
      coachId?: string;
      parentId?: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role?: 'admin' | 'coach' | 'parent' | 'unknown';
    coachId?: string;
    parentId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role?: 'admin' | 'coach' | 'parent' | 'unknown';
    coachId?: string;
    parentId?: string;
  }
}
*/