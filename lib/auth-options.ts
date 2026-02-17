// ============================================================
// FILE: lib/auth-options.ts
// ============================================================
// HARDENED VERSION - Role-based authentication
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - User validation against database
// - Role-based access (admin, coach, parent)
// - Session includes user ID and role
// - Authentication logging
// - Lazy initialization (avoids build-time errors)
// ============================================================

import { NextAuthOptions, Session } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { JWT } from 'next-auth/jwt';

// --- CONFIGURATION (Lazy initialization to avoid build-time errors) ---
const getSupabase = createAdminClient;

import { loadAuthConfig } from '@/lib/config/loader';
import { createAdminClient } from '@/lib/supabase/admin';

// --- TYPES ---
interface ExtendedSession extends Session {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: 'admin' | 'coach' | 'parent' | 'unknown';
    coachId?: string;
    parentId?: string;
  };
}

interface ExtendedToken extends JWT {
  id?: string;
  role?: 'admin' | 'coach' | 'parent' | 'unknown';
  coachId?: string;
  parentId?: string;
}

// --- HELPER FUNCTIONS ---

/**
 * Determine user role from database
 */
async function getUserRole(email: string): Promise<{
  role: 'admin' | 'coach' | 'parent' | 'unknown';
  userId?: string;
  coachId?: string;
  parentId?: string;
}> {
  const supabase = getSupabase();

  // 1. Check if admin
  const authConfig = await loadAuthConfig();
  if (authConfig.adminEmails.includes(email.toLowerCase())) {
    return { role: 'admin' };
  }

  // 2. Check if coach
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, is_active, status')
    .eq('email', email.toLowerCase())
    .single();

  if (coach && coach.is_active) {
    return { role: 'coach', coachId: coach.id };
  }

  // 3. Check if parent
  const { data: parent } = await supabase
    .from('parents')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (parent) {
    return { role: 'parent', parentId: parent.id };
  }

  // 4. Unknown user - could be new parent signing up
  return { role: 'unknown' };
}

/**
 * Log authentication event
 */
async function logAuthEvent(
  email: string,
  event: 'sign_in' | 'sign_in_blocked' | 'sign_out',
  details?: Record<string, unknown>
) {
  try {
    const supabase = getSupabase();
    await supabase.from('activity_log').insert({
      user_email: email,
      user_type: 'admin',
      action: `auth_${event}`,
      metadata: {
        timestamp: new Date().toISOString(),
        ...details,
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log auth event:', error);
  }
}

/**
 * Create or update user record on sign-in
 */
async function syncUserOnSignIn(
  email: string,
  name: string | null | undefined,
  image: string | null | undefined
): Promise<void> {
  const supabase = getSupabase();

  // For parents, create/update parent record
  const { data: existingParent } = await supabase
    .from('parents')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (!existingParent) {
    // Check if this email exists in children table (from assessment)
    const { data: childRecord } = await supabase
      .from('children')
      .select('parent_email, parent_name, parent_phone')
      .eq('parent_email', email.toLowerCase())
      .limit(1)
      .single();

    if (childRecord) {
      // Create parent record from child data
      await supabase.from('parents').insert({
        email: email.toLowerCase(),
        name: name || childRecord.parent_name || 'Parent',
        phone: childRecord.parent_phone,
        avatar_url: image,
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
    }
  } else {
    // Update last login
    await supabase
      .from('parents')
      .update({
        last_seen_at: new Date().toISOString(),
        avatar_url: image || undefined,
      })
      .eq('id', existingParent.id);
  }

  // For coaches, update last login
  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (coach) {
    await supabase
      .from('coaches')
      .update({
        last_seen_at: new Date().toISOString(),
        avatar_url: image || undefined,
      })
      .eq('id', coach.id);
  }
}

// --- NEXTAUTH CONFIG ---
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    /**
     * Sign-in callback - validate user
     */
    async signIn({ user, account, profile }) {
      const email = user.email?.toLowerCase();

      if (!email) {
        console.log('Sign-in blocked: No email provided');
        return false;
      }

      try {
        // Get user role
        const { role, coachId, parentId } = await getUserRole(email);

        // Optional: Block unknown users (uncomment to restrict)
        // if (role === 'unknown') {
        //   await logAuthEvent(email, 'sign_in_blocked', { reason: 'unknown_user' });
        //   return '/login?error=AccessDenied';
        // }

        // Optional: Block inactive coaches
        if (role === 'coach' && coachId) {
          const supabase = getSupabase();
          const { data: coach } = await supabase
            .from('coaches')
            .select('is_active, status')
            .eq('id', coachId)
            .single();

          if (coach && !coach.is_active) {
            await logAuthEvent(email, 'sign_in_blocked', { 
              reason: 'inactive_coach',
              coachStatus: coach.status,
            });
            return '/login?error=AccountInactive';
          }
        }

        // Sync user data
        await syncUserOnSignIn(email, user.name, user.image);

        // Log successful sign-in
        await logAuthEvent(email, 'sign_in', { 
          role,
          provider: account?.provider,
        });

        console.log(`✅ Sign-in successful: ${email} (${role})`);
        return true;

      } catch (error) {
        console.error('Sign-in error:', error);
        // Don't block sign-in on database errors
        return true;
      }
    },

    /**
     * JWT callback - add role to token
     */
    async jwt({ token, user, account, trigger }): Promise<ExtendedToken> {
      // On initial sign-in, add user data to token
      if (user?.email) {
        const { role, coachId, parentId } = await getUserRole(user.email);
        token.role = role;
        token.coachId = coachId;
        token.parentId = parentId;
      }

      // On session update, refresh role (in case it changed)
      if (trigger === 'update' && token.email) {
        const { role, coachId, parentId } = await getUserRole(token.email as string);
        token.role = role;
        token.coachId = coachId;
        token.parentId = parentId;
      }

      return token as ExtendedToken;
    },

    /**
     * Session callback - expose role to client
     */
    async session({ session, token }): Promise<ExtendedSession> {
      const extendedToken = token as ExtendedToken;

      return {
        ...session,
        user: {
          ...session.user,
          id: extendedToken.sub,
          role: extendedToken.role || 'unknown',
          coachId: extendedToken.coachId,
          parentId: extendedToken.parentId,
        },
      } as ExtendedSession;
    },

    /**
     * Redirect callback - role-based redirects
     */
    async redirect({ url, baseUrl }) {
      // Allow relative URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }

      // Allow same-origin URLs
      if (new URL(url).origin === baseUrl) {
        return url;
      }

      return baseUrl;
    },
  },

  events: {
    async signOut({ token }) {
      if (token?.email) {
        await logAuthEvent(token.email as string, 'sign_out', {});
      }
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  // Debug mode (disable in production)
  debug: process.env.NODE_ENV === 'development',
};