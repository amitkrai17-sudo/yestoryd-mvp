// ============================================================
// FILE: app/api/auth/[...nextauth]/route.ts
// ============================================================
// NextAuth route handler
// Config is in lib/auth-options.ts
// ============================================================

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth-options';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };