// =============================================================================
// FILE: app/classes/register/[sessionId]/page.tsx
// PURPOSE: Server component wrapper for registration page
// FIXED: Next.js 15 async params
// =============================================================================

import { Metadata } from 'next';
import RegisterPageClient from './RegisterPageClient';

export const metadata: Metadata = {
  title: 'Register for Group Class | Yestoryd',
  description: 'Register your child for an interactive group reading class. Secure your spot now!',
};

export default async function RegisterPage({ 
  params 
}: { 
  params: Promise<{ sessionId: string }> 
}) {
  const { sessionId } = await params;
  return <RegisterPageClient sessionId={sessionId} />;
}