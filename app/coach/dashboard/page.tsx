// app/coach/dashboard/page.tsx
// Minimal server component — auth check + redirect, data fetched client-side via API

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import CoachDashboardClient from './CoachDashboardClient';

export default async function CoachDashboardPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* Server Component — middleware handles refresh */ }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/coach/login');

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, name, email')
    .eq('email', user.email!)
    .single();

  if (!coach) redirect('/coach/login');

  return <CoachDashboardClient coachName={coach.name} />;
}
