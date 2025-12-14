/**
 * NextAuth Configuration
 * 
 * Handles Google OAuth authentication for the assessment page
 * 
 * Setup Steps:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com
 * 2. Create a new project or select existing
 * 3. Enable Google+ API
 * 4. Go to Credentials → Create Credentials → OAuth Client ID
 * 5. Application type: Web application
 * 6. Add authorized redirect URIs:
 *    - http://localhost:3000/api/auth/callback/google (development)
 *    - https://yestoryd.com/api/auth/callback/google (production)
 * 7. Copy Client ID and Client Secret to .env.local
 */

import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token and user info to the token
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile) {
        token.name = profile.name;
        token.email = profile.email;
        token.picture = (profile as any).picture;
      }
      return token;
    },
    
    async session({ session, token }) {
      // Send properties to the client
      if (session.user) {
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  
  pages: {
    signIn: '/assessment', // Redirect to assessment page
    error: '/assessment',  // Error page
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
