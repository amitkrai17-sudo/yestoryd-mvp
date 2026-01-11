// file: lib/notify-coach-assignment.ts
// Helper to send notification when a child is assigned to a coach
// Import and call this function wherever coach assignment happens

export async function notifyCoachAssignment({
  coachId,
  childId,
  enrollmentId,
  firstSessionDate,
  firstSessionTime,
}: {
  coachId: string;
  childId: string;
  enrollmentId?: string;
  firstSessionDate?: string;
  firstSessionTime?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';
    
    const response = await fetch(`${baseUrl}/api/coach/notify-assignment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coachId,
        childId,
        enrollmentId,
        firstSessionDate,
        firstSessionTime,
      }),
    });

    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error: any) {
    console.error('Failed to notify coach:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================
// INTEGRATION POINTS - Add these calls to existing code
// =============================================================

/*
INTEGRATION 1: When admin assigns coach in CRM
------------------------------------------------
File: app/admin/crm/page.tsx (or wherever coach assignment happens)

Add after the coach assignment is saved:

import { notifyCoachAssignment } from '@/lib/notify-coach-assignment';

// After: await supabase.from('discovery_calls').update({ coach_id: coachId })...

await notifyCoachAssignment({
  coachId: selectedCoachId,
  childId: discoveryCall.child_id,
});


INTEGRATION 2: When auto-assignment happens in Cal.com webhook
--------------------------------------------------------------
File: app/api/webhooks/cal/route.ts

Add after round-robin assignment:

import { notifyCoachAssignment } from '@/lib/notify-coach-assignment';

// After: coach_id is set

if (assignedCoachId && childId) {
  await notifyCoachAssignment({
    coachId: assignedCoachId,
    childId: childId,
  });
}


INTEGRATION 3: When enrollment is created with coach
----------------------------------------------------
File: app/api/jobs/enrollment-complete/route.ts

Add after coach is assigned and sessions are scheduled:

import { notifyCoachAssignment } from '@/lib/notify-coach-assignment';

// After: sessions are created

if (enrollment.coach_id && enrollment.child_id) {
  await notifyCoachAssignment({
    coachId: enrollment.coach_id,
    childId: enrollment.child_id,
    enrollmentId: enrollment.id,
  });
}

*/
