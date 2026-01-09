// ============================================================
// FILE: types/next-auth.d.ts
// ============================================================
// Type declarations for extended NextAuth session
// Yestoryd - AI-Powered Reading Intelligence Platform
// ============================================================

import NextAuth, { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extended Session with role and IDs
   */
  interface Session {
    user: {
      id?: string;
      role?: 'admin' | 'coach' | 'parent' | 'unknown';
      coachId?: string;
      parentId?: string;
    } & DefaultSession['user'];
  }

  /**
   * Extended User
   */
  interface User extends DefaultUser {
    role?: 'admin' | 'coach' | 'parent' | 'unknown';
    coachId?: string;
    parentId?: string;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extended JWT with role and IDs
   */
  interface JWT extends DefaultJWT {
    role?: 'admin' | 'coach' | 'parent' | 'unknown';
    coachId?: string;
    parentId?: string;
  }
}