// ============================================================
// POST /api/communication/trigger
// ============================================================
// Thin wrapper for manual template-based message triggers by coaches/admins.
// Calls sendCommunication() directly (NOT /api/communication/send).
// Adds: context-based variable resolution, permission checks, trigger logging.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { sendCommunication } from '@/lib/communication';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const TriggerSchema = z.object({
  templateCode: z.string().min(1).max(100),
  recipientType: z.enum(['parent', 'coach']),
  recipientId: z.string().uuid().optional(),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().max(100).optional(),
  contextType: z.enum(['session', 'enrollment', 'tuition', 'general']),
  contextId: z.string().uuid().optional(),
  channelOverride: z.array(z.enum(['whatsapp', 'email'])).optional(),
  customVariables: z.record(z.string()).optional(),
});

// TODO: type properly — new columns (trigger_contexts, coach_can_trigger, admin_can_trigger)
// not yet in generated types. Regenerate after migration: npx supabase gen types typescript --linked
interface TemplateRow {
  id: string;
  template_code: string;
  name: string;
  trigger_contexts: string[] | null;
  coach_can_trigger: boolean | null;
  admin_can_trigger: boolean | null;
  use_whatsapp: boolean | null;
  use_email: boolean | null;
  wa_variables: string[] | null;
  required_variables: string[] | null;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth — coach or admin only
    const auth = await requireAdminOrCoach();
    if (!auth.authorized || !auth.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse + validate
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validation = TriggerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const params = validation.data;
    const supabase = getServiceSupabase();

    // 3. Fetch template + verify permissions
    // Cast to any to access new columns not yet in generated types
    const { data: rawTemplate, error: templateError } = await (supabase as any)
      .from('communication_templates')
      .select('id, template_code, name, trigger_contexts, coach_can_trigger, admin_can_trigger, use_whatsapp, use_email, wa_variables, required_variables')
      .eq('template_code', params.templateCode)
      .eq('is_active', true)
      .single();

    const template = rawTemplate as TemplateRow | null;

    if (templateError || !template) {
      return NextResponse.json(
        { success: false, error: `Template not found or inactive: ${params.templateCode}` },
        { status: 404 }
      );
    }

    // 4. Verify trigger context is allowed for this template
    const triggerContexts = template.trigger_contexts || [];
    if (triggerContexts.length > 0 && !triggerContexts.includes(params.contextType)) {
      return NextResponse.json(
        { success: false, error: `Template "${template.name}" cannot be triggered from context "${params.contextType}"` },
        { status: 403 }
      );
    }

    // 5. Permission check: coaches need coach_can_trigger
    if (auth.role === 'coach' && template.coach_can_trigger === false) {
      return NextResponse.json(
        { success: false, error: `Template "${template.name}" is admin-only` },
        { status: 403 }
      );
    }

    if (auth.role === 'admin' && template.admin_can_trigger === false) {
      return NextResponse.json(
        { success: false, error: `Template "${template.name}" cannot be triggered manually` },
        { status: 403 }
      );
    }

    // 6. Auto-resolve variables from context
    const resolvedVariables: Record<string, string> = {};

    if (params.contextType === 'session' && params.contextId) {
      const { data: session } = await supabase
        .from('scheduled_sessions')
        .select(`id, scheduled_date, scheduled_time, status, session_number, coach_id, child_id,
          children!scheduled_sessions_child_id_fkey (child_name, parent_name, parent_phone, parent_email),
          coaches!scheduled_sessions_coach_id_fkey (name)`)
        .eq('id', params.contextId)
        .single();

      if (session) {
        const child = (session as any).children;
        const coach = (session as any).coaches;
        resolvedVariables.child_name = child?.child_name || '';
        resolvedVariables.parent_name = child?.parent_name || '';
        resolvedVariables.coach_name = coach?.name || '';
        resolvedVariables.session_date = new Date(
          `${session.scheduled_date}T${session.scheduled_time}`
        ).toLocaleDateString('en-IN', {
          weekday: 'long', day: 'numeric', month: 'short',
        });
        resolvedVariables.session_number = String(session.session_number || '');

        // Auto-fill recipient if not provided
        if (!params.recipientPhone && child?.parent_phone) {
          params.recipientPhone = child.parent_phone;
        }
        if (!params.recipientEmail && child?.parent_email) {
          params.recipientEmail = child.parent_email;
        }
        if (!params.recipientName && child?.parent_name) {
          params.recipientName = child.parent_name;
        }
      }
    } else if ((params.contextType === 'enrollment' || params.contextType === 'tuition') && params.contextId) {
      const selectCols = params.contextType === 'enrollment'
        ? 'id, plan_name, sessions_remaining, age_band, child_id, children!inner(child_name, parent_name, parent_phone, parent_email)'
        : 'id, plan_name, child_id, children!inner(child_name, parent_name, parent_phone, parent_email)';

      const { data: enrollment } = await supabase
        .from('enrollments')
        .select(selectCols)
        .eq('id', params.contextId)
        .single();

      if (enrollment) {
        const child = (enrollment as any).children;
        resolvedVariables.child_name = child?.child_name || '';
        resolvedVariables.parent_name = child?.parent_name || '';
        if (params.contextType === 'enrollment') {
          resolvedVariables.plan_name = (enrollment as any).plan_name || '';
          resolvedVariables.sessions_remaining = String((enrollment as any).sessions_remaining || '');
          resolvedVariables.age_band = (enrollment as any).age_band || '';
        }

        if (!params.recipientPhone && child?.parent_phone) {
          params.recipientPhone = child.parent_phone;
        }
        if (!params.recipientEmail && child?.parent_email) {
          params.recipientEmail = child.parent_email;
        }
        if (!params.recipientName && child?.parent_name) {
          params.recipientName = child.parent_name;
        }
      }
    }

    // Merge: custom variables override auto-resolved
    const finalVariables = { ...resolvedVariables, ...(params.customVariables || {}) };

    // 7. Determine skip channels based on override
    let skipChannels: ('whatsapp' | 'email' | 'sms')[] | undefined;
    if (params.channelOverride) {
      skipChannels = [];
      if (!params.channelOverride.includes('whatsapp')) skipChannels.push('whatsapp');
      if (!params.channelOverride.includes('email')) skipChannels.push('email');
    }

    // 8. Send via sendCommunication() with trigger metadata
    const result = await sendCommunication({
      templateCode: params.templateCode,
      recipientType: params.recipientType,
      recipientId: params.recipientId,
      recipientPhone: params.recipientPhone,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      variables: finalVariables,
      relatedEntityType: params.contextType,
      relatedEntityId: params.contextId,
      skipChannels,
      triggeredBy: auth.role as 'coach' | 'admin',
      triggeredByUserId: auth.userId,
      contextType: params.contextType,
      contextId: params.contextId,
    });

    // 9. Also log to activity_log for audit trail
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      user_type: auth.role || 'admin',
      action: 'communication_trigger',
      metadata: {
        template_code: params.templateCode,
        template_name: template.name,
        context_type: params.contextType,
        context_id: params.contextId,
        recipient_type: params.recipientType,
        recipient_name: params.recipientName,
        channels_sent: result.results.filter(r => r.success).map(r => r.channel),
        success: result.success,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: result.success,
      templateName: template.name,
      channels: result.results,
    });

  } catch (error) {
    console.error('[CommunicationTrigger] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
