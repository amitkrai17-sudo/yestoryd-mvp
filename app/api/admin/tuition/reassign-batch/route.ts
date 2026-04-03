// POST /api/admin/tuition/reassign-batch
// Move a tuition student to a different batch.
// Updates tuition_onboarding + all future scheduled_sessions + Calendar attendees.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { google } from 'googleapis';
import { withApiHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

const ReassignSchema = z.object({
  onboardingId: z.string().uuid(),
  newBatchId: z.string().uuid(),
});

export const POST = withApiHandler(async (req: NextRequest, { supabase, requestId }) => {
  const body = await req.json();
  const parsed = ReassignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { onboardingId, newBatchId } = parsed.data;

  // 1. Get current onboarding record (BEFORE update — need old calendar_event_id)
  const { data: onboarding, error: fetchErr } = await supabase
    .from('tuition_onboarding')
    .select('*')
    .eq('id', onboardingId)
    .single();

  if (fetchErr || !onboarding) {
    return NextResponse.json({ error: 'Onboarding record not found' }, { status: 404 });
  }

  const oldBatchId = onboarding.batch_id;
  const oldCalendarEventId = onboarding.calendar_event_id;

  if (oldBatchId === newBatchId) {
    return NextResponse.json({ message: 'Already in this batch', changed: false });
  }

  // 2. Resolve parent email for Calendar attendee management
  let parentEmail: string | null = null;
  let parentName: string | null = null;
  if (onboarding.parent_id) {
    const { data: parent } = await supabase
      .from('parents')
      .select('email, name')
      .eq('id', onboarding.parent_id)
      .single();
    parentEmail = parent?.email ?? null;
    parentName = parent?.name ?? null;
  }
  // Fallback: look up from children table via enrollment
  if (!parentEmail && onboarding.enrollment_id) {
    const { data: enr } = await supabase
      .from('enrollments')
      .select('parent_id')
      .eq('id', onboarding.enrollment_id)
      .single();
    if (enr?.parent_id) {
      const { data: parent } = await supabase
        .from('parents')
        .select('email, name')
        .eq('id', enr.parent_id)
        .single();
      parentEmail = parent?.email ?? null;
      parentName = parent?.name ?? null;
    }
  }

  // 3. Get the target batch's meet_link + calendar_event_id (from any sibling)
  const { data: targetSibling } = await supabase
    .from('tuition_onboarding')
    .select('meet_link, calendar_event_id')
    .eq('batch_id', newBatchId)
    .not('meet_link', 'is', null)
    .limit(1)
    .maybeSingle();

  const newMeetLink = targetSibling?.meet_link ?? null;
  const newCalendarEventId = targetSibling?.calendar_event_id ?? null;

  // 4. Update tuition_onboarding with new batch
  await supabase
    .from('tuition_onboarding')
    .update({
      batch_id: newBatchId,
      meet_link: newMeetLink,
      calendar_event_id: newCalendarEventId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', onboardingId);

  // 5. Update all FUTURE scheduled_sessions for this enrollment
  const today = new Date().toISOString().split('T')[0];
  if (onboarding.enrollment_id) {
    const updateFields: Record<string, unknown> = {
      batch_id: newBatchId,
      updated_at: new Date().toISOString(),
    };
    // Copy persistent classroom link to session (tuition_onboarding.meet_link → scheduled_sessions.google_meet_link)
    if (newMeetLink) updateFields.google_meet_link = newMeetLink;

    await supabase
      .from('scheduled_sessions')
      .update(updateFields)
      .eq('enrollment_id', onboarding.enrollment_id)
      .gte('scheduled_date', today)
      .in('status', ['scheduled', 'pending_scheduling', 'pending', 'confirmed']);
  }

  // 6. Calendar attendee management (non-blocking — DB changes already committed)
  if (parentEmail) {
    // Get coach email for Calendar API (coach is the calendar organizer)
    const { data: coach } = await supabase
      .from('coaches')
      .select('email')
      .eq('id', onboarding.coach_id)
      .single();

    const coachEmail = coach?.email;

    if (coachEmail) {
      try {
        const auth = new google.auth.JWT(
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          undefined,
          process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          ['https://www.googleapis.com/auth/calendar'],
          coachEmail,
        );
        const calendar = google.calendar({ version: 'v3', auth });

        // 6a. Remove parent from OLD Calendar event
        if (oldCalendarEventId && oldCalendarEventId !== newCalendarEventId) {
          try {
            const oldEvent = await calendar.events.get({
              calendarId: coachEmail,
              eventId: oldCalendarEventId,
            });
            const oldAttendees = (oldEvent.data.attendees || []).filter(
              (a: any) => a.email !== parentEmail
            );
            await calendar.events.patch({
              calendarId: coachEmail,
              eventId: oldCalendarEventId,
              sendUpdates: 'all',
              requestBody: { attendees: oldAttendees },
            });
            console.log(JSON.stringify({
              requestId,
              event: 'batch_attendee_removed_from_old',
              parentEmail,
              oldCalendarEventId,
            }));
          } catch (removeErr: any) {
            console.error(JSON.stringify({
              requestId,
              event: 'batch_attendee_remove_error',
              error: removeErr.message,
              oldCalendarEventId,
            }));
          }
        }

        // 6b. Add parent to NEW Calendar event
        if (newCalendarEventId) {
          try {
            const newEvent = await calendar.events.get({
              calendarId: coachEmail,
              eventId: newCalendarEventId,
            });
            const currentAttendees = newEvent.data.attendees || [];
            const alreadyAdded = currentAttendees.some(
              (a: any) => a.email === parentEmail
            );
            if (!alreadyAdded) {
              await calendar.events.patch({
                calendarId: coachEmail,
                eventId: newCalendarEventId,
                sendUpdates: 'all',
                requestBody: {
                  attendees: [
                    ...currentAttendees,
                    { email: parentEmail, displayName: parentName || 'Parent' },
                  ],
                },
              });
              console.log(JSON.stringify({
                requestId,
                event: 'batch_attendee_added_to_new',
                parentEmail,
                newCalendarEventId,
              }));
            }
          } catch (addErr: any) {
            console.error(JSON.stringify({
              requestId,
              event: 'batch_attendee_add_error',
              error: addErr.message,
              newCalendarEventId,
            }));
          }
        }
      } catch (calErr: any) {
        // Calendar failure does NOT roll back DB changes
        console.error(JSON.stringify({
          requestId,
          event: 'batch_calendar_auth_error',
          error: calErr.message,
        }));
        try {
          await supabase.from('activity_log').insert({
            action: 'batch_calendar_update_failed',
            user_email: 'admin',
            user_type: 'system',
            metadata: {
              onboarding_id: onboardingId,
              error: calErr.message,
              old_calendar_event_id: oldCalendarEventId,
              new_calendar_event_id: newCalendarEventId,
            },
          });
        } catch { /* swallow logging failure */ }
      }
    }
  }

  // 7. Activity log
  await supabase.from('activity_log').insert({
    action: 'tuition_batch_reassigned',
    user_email: 'admin',
    user_type: 'admin',
    metadata: {
      onboarding_id: onboardingId,
      child_name: onboarding.child_name,
      old_batch_id: oldBatchId,
      new_batch_id: newBatchId,
      old_calendar_event_id: oldCalendarEventId,
      new_calendar_event_id: newCalendarEventId,
      parent_email: parentEmail,
      sessions_updated: true,
    },
  });

  console.log(JSON.stringify({
    requestId,
    event: 'batch_reassigned',
    onboardingId,
    childName: onboarding.child_name,
    oldBatchId,
    newBatchId,
    meetLinkCopied: !!newMeetLink,
    calendarUpdated: !!(oldCalendarEventId || newCalendarEventId),
  }));

  return NextResponse.json({
    success: true,
    changed: true,
    newBatchId,
    meetLink: newMeetLink,
  });
}, { auth: 'admin' });
