// ============================================================
// FILE: app/api/admin/setup-qstash-schedules/route.ts
// ============================================================
// HARDENED VERSION - QStash Schedule Management
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// Note: Original used CRON_SECRET header - now uses proper admin auth
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';
import { Client } from '@upstash/qstash';

export const dynamic = 'force-dynamic';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// --- VALIDATION SCHEMAS ---
const setupActionSchema = z.object({
  action: z.enum(['setup', 'list', 'delete']),
  scheduleId: z.string().optional(),
});

// --- POST: Setup/Delete schedules ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'qstash_schedules_post_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = setupActionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid action. Use: setup, list, or delete',
        details: validation.error.flatten(),
        usage: {
          setup: 'Creates the 1hr reminder schedule',
          list: 'Lists all QStash schedules',
          delete: 'Deletes a schedule (requires scheduleId in body)',
        },
      }, { status: 400 });
    }

    const { action, scheduleId } = validation.data;
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';

    console.log(JSON.stringify({ requestId, event: 'qstash_schedules_post_request', adminEmail: auth.email, action }));

    const supabase = getServiceSupabase();

    if (action === 'setup') {
      // Create schedule for 1-hour coach reminders
      const schedule = await qstash.schedules.create({
        destination: `${appUrl}/api/cron/coach-reminders-1h`,
        cron: '0 * * * *', // Every hour
        retries: 3,
      });

      // Audit log
      await supabase.from('activity_log').insert({
        user_email: auth.email,
        action: 'qstash_schedule_created',
        details: {
          request_id: requestId,
          schedule_id: schedule.scheduleId,
          cron: '0 * * * *',
          destination: `${appUrl}/api/cron/coach-reminders-1h`,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

      const duration = Date.now() - startTime;
      console.log(JSON.stringify({ requestId, event: 'qstash_schedule_created', scheduleId: schedule.scheduleId, duration: `${duration}ms` }));

      return NextResponse.json({
        success: true,
        requestId,
        message: 'QStash schedule created for 1hr coach reminders',
        scheduleId: schedule.scheduleId,
        cron: '0 * * * *',
        destination: `${appUrl}/api/cron/coach-reminders-1h`,
      });

    } else if (action === 'list') {
      const schedules = await qstash.schedules.list();

      const duration = Date.now() - startTime;
      console.log(JSON.stringify({ requestId, event: 'qstash_schedules_listed', count: schedules.length, duration: `${duration}ms` }));

      return NextResponse.json({
        success: true,
        requestId,
        count: schedules.length,
        schedules: schedules.map(s => ({
          scheduleId: s.scheduleId,
          destination: s.destination,
          cron: s.cron,
          createdAt: s.createdAt,
        })),
      });

    } else if (action === 'delete') {
      if (!scheduleId) {
        return NextResponse.json({ error: 'scheduleId required for delete action' }, { status: 400 });
      }

      await qstash.schedules.delete(scheduleId);

      // Audit log
      await supabase.from('activity_log').insert({
        user_email: auth.email,
        action: 'qstash_schedule_deleted',
        details: { request_id: requestId, schedule_id: scheduleId, timestamp: new Date().toISOString() },
        created_at: new Date().toISOString(),
      });

      const duration = Date.now() - startTime;
      console.log(JSON.stringify({ requestId, event: 'qstash_schedule_deleted', scheduleId, duration: `${duration}ms` }));

      return NextResponse.json({
        success: true,
        requestId,
        message: `Deleted schedule ${scheduleId}`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'qstash_schedules_post_error', error: error.message }));
    return NextResponse.json({ success: false, error: error.message, requestId }, { status: 500 });
  }
}

// --- GET: List schedules ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'qstash_schedules_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'qstash_schedules_get_request', adminEmail: auth.email }));

    const schedules = await qstash.schedules.list();

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'qstash_schedules_get_success', count: schedules.length, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      count: schedules.length,
      schedules: schedules.map(s => ({
        scheduleId: s.scheduleId,
        destination: s.destination,
        cron: s.cron,
        createdAt: s.createdAt,
      })),
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'qstash_schedules_get_error', error: error.message }));
    return NextResponse.json({ success: false, error: error.message, requestId }, { status: 500 });
  }
}
