

// file: app/coach/dashboard/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import CoachDashboardClient from './CoachDashboardClient';
import { Database } from '@/types/supabase';

type ScheduledSessionRow = Database['public']['Tables']['scheduled_sessions']['Row'];
type ChildRow = Database['public']['Tables']['children']['Row'];

type ScheduledSessionWithChild = ScheduledSessionRow & {
  children: Pick<ChildRow, 'child_name' | 'name'> | null;
};

export default async function CoachDashboardPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/coach/login');
  }

  const { data: coach } = await supabase
    .from('coaches')
    .select('*')
    .eq('email', user.email)
    .single();

  if (!coach) {
    redirect('/coach/login');
  }

  // Fetch stats
  const { count: studentsCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coach.id)
    .in('status', ['active', 'pending_start', 'completed']);

  const { count: activeCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coach.id)
    .in('status', ['active', 'pending_start']);

  let sessionsCount = 0;
  try {
    const { count } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coach.id)
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .eq('status', 'scheduled');
    sessionsCount = count || 0;
  } catch (e) {
    console.log('scheduled_sessions table may not exist');
  }

  // TODO: Fetch earnings from single source of truth API
  // This needs to be a direct DB query or a server-to-server fetch if the API is secure.
  // For now, we'll pass 0 as a placeholder.
  const totalEarnings = 0;

  const initialStats = {
    total_students: studentsCount || 0,
    active_students: activeCount || 0,
    upcoming_sessions: sessionsCount,
    total_earnings: totalEarnings,
  };

  // Fetch pending skill boosters
  const { data: pendingSessions, error } = await supabase
    .from('scheduled_sessions')
    .select(`
      id,
      child_id,
      focus_area,
      created_at,
      children:child_id (
        child_name,
        name
      )
    `)
    .eq('coach_id', coach.id)
    .eq('session_type', 'remedial')
    .eq('status', 'pending_booking')
    .order('created_at', { ascending: false });

  const initialPendingSkillBoosters = (pendingSessions || []).map((session: any) => {
    const daysPending = Math.floor(
      (Date.now() - new Date(session.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const children = Array.isArray(session.children) ? session.children[0] : session.children;
    return {
      id: session.id,
      child_id: session.child_id,
      child_name: children?.child_name || children?.name || 'Unknown',
      focus_area: session.focus_area || 'general',
      created_at: session.created_at,
      days_pending: daysPending,
    };
  });


  return (
    <CoachDashboardClient
      coach={coach}
      initialStats={initialStats}
      initialPendingSkillBoosters={initialPendingSkillBoosters}
    />
  );
}
