// file: app/api/cron/coach-reminders-1h/route.ts
// 1-hour session reminders for coaches
// Called by QStash schedule (not Vercel cron) every hour
// This doesn't count against Vercel's 2 cron limit!

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Receiver } from '@upstash/qstash';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify request is from QStash or authorized caller
async function verifyRequest(request: NextRequest): Promise<boolean> {
  // Check for CRON_SECRET (manual testing)
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // Check for QStash signature
  const signature = request.headers.get('upstash-signature');
  if (signature) {
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
      });

      const body = await request.text();
      const isValid = await receiver.verify({
        signature,
        body,
      });
      return isValid;
    } catch (e) {
      console.error('QStash signature verification failed:', e);
      return false;
    }
  }

  return false;
}

export async function GET(request: NextRequest) {
  // For GET requests, just check auth header
  const authHeader = request.headers.get('authorization');
  const qstashSig = request.headers.get('upstash-signature');
  
  if (!qstashSig && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return processReminders();
}

export async function POST(request: NextRequest) {
  const isValid = await verifyRequest(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return processReminders();
}

async function processReminders() {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    
    const todayStr = nowIST.toISOString().split('T')[0];
    const currentHour = nowIST.getHours();
    const targetHour = currentHour + 1;

    // Skip if target hour is past midnight (would be next day)
    if (targetHour >= 24) {
      return NextResponse.json({
        success: true,
        message: 'No sessions in next hour (past midnight)',
        results,
      });
    }

    // Format target time range
    const targetTimeStart = `${String(targetHour).padStart(2, '0')}:00:00`;
    const targetTimeEnd = `${String(targetHour).padStart(2, '0')}:59:59`;

    console.log(`⏰ Checking for sessions between ${targetTimeStart} and ${targetTimeEnd} on ${todayStr}`);

    // Get sessions in the next hour
    const { data: sessions, error } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        scheduled_date,
        scheduled_time,
        session_type,
        coach_id,
        child_id,
        google_meet_link,
        coach_reminder_1h_sent,
        children (
          id,
          name,
          child_name
        ),
        coaches (
          id,
          name,
          phone,
          email
        )
      `)
      .eq('scheduled_date', todayStr)
      .eq('status', 'scheduled')
      .gte('scheduled_time', targetTimeStart)
      .lte('scheduled_time', targetTimeEnd)
      .or('coach_reminder_1h_sent.is.null,coach_reminder_1h_sent.eq.false');

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      console.log('No sessions found for 1h reminders');
      return NextResponse.json({
        success: true,
        message: 'No sessions in next hour',
        results,
      });
    }

    console.log(`📅 Found ${sessions.length} sessions for 1h reminders`);

    for (const session of sessions) {
      const coach = session.coaches as any;
      const child = session.children as any;

      if (!coach?.phone) {
        results.errors.push(`Session ${session.id}: Coach has no phone`);
        continue;
      }

      const childName = child?.name || child?.child_name || 'Student';
      const coachFirstName = coach.name?.split(' ')[0] || 'Coach';
      const sessionTime = session.scheduled_time?.slice(0, 5) || 'soon';

      try {
        // Send WhatsApp via AiSensy
        const waResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: process.env.AISENSY_API_KEY,
            campaignName: 'coach_session_1h',
            destination: coach.phone.replace(/\D/g, ''),
            userName: 'Yestoryd',
            templateParams: [
              coachFirstName,
              childName,
              sessionTime,
            ],
          }),
        });

        if (waResponse.ok) {
          await supabase
            .from('scheduled_sessions')
            .update({
              coach_reminder_1h_sent: true,
              coach_reminder_1h_sent_at: new Date().toISOString(),
            })
            .eq('id', session.id);

          results.sent++;
          console.log(`✅ 1h reminder sent to ${coach.name} for ${childName}`);
        } else {
          const errText = await waResponse.text();
          results.failed++;
          results.errors.push(`Session ${session.id}: ${errText}`);
        }
      } catch (e: any) {
        results.failed++;
        results.errors.push(`Session ${session.id}: ${e.message}`);
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('📊 1h reminder cron complete:', results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      targetTime: `${targetTimeStart} - ${targetTimeEnd}`,
      results,
    });

  } catch (error: any) {
    console.error('1h reminder cron error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
