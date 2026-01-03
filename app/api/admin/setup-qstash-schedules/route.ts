// file: app/api/admin/setup-qstash-schedules/route.ts
// One-time setup endpoint to create QStash schedules
// Run once after deployment to set up hourly coach reminders
// QStash schedules don't count against Vercel cron limit!

import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// Admin auth check
function isAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action } = await request.json();
  const appUrl = 'https://www.yestoryd.com';

  try {
    if (action === 'setup') {
      // Create schedule for 1-hour coach reminders
      // Runs every hour at :00
      const schedule = await qstash.schedules.create({
        destination: `${appUrl}/api/cron/coach-reminders-1h`,
        cron: '0 * * * *', // Every hour
        retries: 3,
      });

      console.log('✅ Created 1hr reminder schedule:', schedule.scheduleId);

      return NextResponse.json({
        success: true,
        message: 'QStash schedule created for 1hr coach reminders',
        scheduleId: schedule.scheduleId,
        cron: '0 * * * *',
        destination: `${appUrl}/api/cron/coach-reminders-1h`,
      });

    } else if (action === 'list') {
      // List all schedules
      const schedules = await qstash.schedules.list();
      return NextResponse.json({
        success: true,
        schedules: schedules.map(s => ({
          scheduleId: s.scheduleId,
          destination: s.destination,
          cron: s.cron,
          createdAt: s.createdAt,
        })),
      });

    } else if (action === 'delete') {
      const { scheduleId } = await request.json();
      if (!scheduleId) {
        return NextResponse.json({ error: 'scheduleId required' }, { status: 400 });
      }
      await qstash.schedules.delete(scheduleId);
      return NextResponse.json({
        success: true,
        message: `Deleted schedule ${scheduleId}`,
      });

    } else {
      return NextResponse.json({
        error: 'Invalid action. Use: setup, list, or delete',
        usage: {
          setup: 'Creates the 1hr reminder schedule',
          list: 'Lists all QStash schedules',
          delete: 'Deletes a schedule (requires scheduleId in body)',
        },
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('QStash schedule error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET to list schedules
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const schedules = await qstash.schedules.list();
    return NextResponse.json({
      success: true,
      count: schedules.length,
      schedules: schedules.map(s => ({
        scheduleId: s.scheduleId,
        destination: s.destination,
        cron: s.cron,
        createdAt: s.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
