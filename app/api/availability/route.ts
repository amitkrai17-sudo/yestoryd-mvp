// app/api/availability/route.ts
// Check coach availability for scheduling

import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/googleCalendar';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachEmail = searchParams.get('coachEmail');
    const date = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration') || '45');

    if (!coachEmail || !date) {
      return NextResponse.json(
        { error: 'coachEmail and date are required' },
        { status: 400 }
      );
    }

    const slots = await getAvailableSlots(coachEmail, new Date(date), duration);

    return NextResponse.json({
      success: true,
      date,
      coachEmail,
      slots: slots.map(slot => ({
  	start: slot.start,  // ✅ Already a string
  	end: slot.end,      // ✅ Already a string
        startFormatted: slot.start.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
