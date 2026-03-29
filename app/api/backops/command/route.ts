// ============================================================
// FILE: app/api/backops/command/route.ts
// PURPOSE: BackOps Command API — operational actions
// AUTH: x-backops-key header
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyBackOpsAuth } from '@/lib/backops/auth';
import { logOpsEvent, invalidatePolicyCache } from '@/lib/backops';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

type CommandType =
  | 'force_nudge'
  | 'suppress_nudge'
  | 'override_lead_score'
  | 'pause_automation'
  | 'resume_automation'
  | 'send_alert'
  | 'update_policy'
  | 'resolve_pending';

interface CommandRequest {
  command: CommandType;
  entity_type?: string;
  entity_id?: string;
  params?: Record<string, unknown>;
  reason?: string;
}

export async function POST(request: NextRequest) {
  const auth = verifyBackOpsAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: CommandRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.command) {
    return NextResponse.json({ error: 'Missing command' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (body.command) {
      case 'force_nudge':
        return await cmdForceNudge(supabase, body);
      case 'suppress_nudge':
        return await cmdSuppressNudge(body);
      case 'override_lead_score':
        return await cmdOverrideLeadScore(supabase, body);
      case 'pause_automation':
        return await cmdPauseAutomation(body);
      case 'resume_automation':
        return await cmdResumeAutomation(body);
      case 'send_alert':
        return await cmdSendAlert(body);
      case 'update_policy':
        return await cmdUpdatePolicy(supabase, body);
      case 'resolve_pending':
        return await cmdResolvePending(supabase, body);
      default:
        return NextResponse.json(
          { error: `Unknown command: ${body.command}` },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error('[BackOps Command] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal command error' }, { status: 500 });
  }
}

// ── force_nudge: Send a WhatsApp nudge immediately ──

async function cmdForceNudge(
  supabase: ReturnType<typeof createAdminClient>,
  body: CommandRequest,
) {
  const phone = body.params?.phone as string;
  const template = body.params?.template as string;
  const variables = (body.params?.variables as string[]) || [];

  if (!phone || !template) {
    return NextResponse.json(
      { error: 'force_nudge requires params.phone and params.template' },
      { status: 400 },
    );
  }

  try {
    const result = await sendWhatsAppMessage({ to: phone, templateName: template, variables });

    await logOpsEvent({
      event_type: 'nudge_sent',
      source: 'backops:force_nudge',
      severity: result.success ? 'info' : 'warning',
      entity_type: (body.entity_type as 'child' | 'parent' | 'coach') || undefined,
      entity_id: body.entity_id,
      action_taken: `aisensy:${template}`,
      action_outcome: result.success ? 'success' : 'failed',
      resolved_by: 'openclaw',
      metadata: {
        phone,
        template,
        variables,
        message_id: result.messageId || null,
        error: result.error || null,
        reason: body.reason || null,
      } as Json,
    });

    const summary = result.success
      ? `Nudge sent: ${template} to ${phone.slice(-4)}`
      : `Nudge FAILED: ${result.error}`;

    return NextResponse.json({ data: { success: result.success, message_id: result.messageId }, summary });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ data: { success: false }, summary: `Nudge failed: ${errorMsg}` });
  }
}

// ── suppress_nudge: Log suppression event for crons to check ──

async function cmdSuppressNudge(body: CommandRequest) {
  if (!body.entity_type || !body.entity_id) {
    return NextResponse.json(
      { error: 'suppress_nudge requires entity_type and entity_id' },
      { status: 400 },
    );
  }

  const duration_hours = (body.params?.duration_hours as number) || 24;

  await logOpsEvent({
    event_type: 'nudge_suppressed',
    source: 'backops:suppress_nudge',
    severity: 'info',
    entity_type: body.entity_type as 'child' | 'parent' | 'coach',
    entity_id: body.entity_id,
    decision_made: 'suppress_nudge',
    decision_reason: {
      reason: body.reason || 'Manual suppression via BackOps',
      duration_hours,
      expires_at: new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString(),
    } as Json,
    action_outcome: 'suppressed',
    resolved_by: 'openclaw',
  });

  const summary = `Nudges suppressed for ${body.entity_type} ${body.entity_id.slice(0, 8)} for ${duration_hours}h`;
  return NextResponse.json({ data: { success: true, duration_hours }, summary });
}

// ── override_lead_score: Force a lead score value ──

async function cmdOverrideLeadScore(
  supabase: ReturnType<typeof createAdminClient>,
  body: CommandRequest,
) {
  if (!body.entity_id) {
    return NextResponse.json(
      { error: 'override_lead_score requires entity_id (child UUID)' },
      { status: 400 },
    );
  }

  const new_score = body.params?.score as number;
  if (typeof new_score !== 'number' || new_score < 0 || new_score > 200) {
    return NextResponse.json(
      { error: 'override_lead_score requires params.score (0-200)' },
      { status: 400 },
    );
  }

  // Fetch current score
  const { data: child } = await supabase
    .from('children')
    .select('lead_score, child_name')
    .eq('id', body.entity_id)
    .single();

  if (!child) {
    return NextResponse.json({ error: 'Child not found' }, { status: 404 });
  }

  const old_score = child.lead_score;

  // Update
  const { error: updateErr } = await supabase
    .from('children')
    .update({ lead_score: new_score, lead_score_updated_at: new Date().toISOString() })
    .eq('id', body.entity_id);

  if (updateErr) {
    return NextResponse.json({ error: `Update failed: ${updateErr.message}` }, { status: 500 });
  }

  await logOpsEvent({
    event_type: 'override_applied',
    source: 'backops:override_lead_score',
    severity: 'info',
    entity_type: 'child',
    entity_id: body.entity_id,
    decision_made: 'override_lead_score',
    decision_reason: {
      old_score,
      new_score,
      reason: body.reason || 'Manual override via BackOps',
    } as Json,
    action_outcome: 'success',
    resolved_by: 'openclaw',
  });

  const summary = `Lead score for ${child.child_name}: ${old_score} -> ${new_score}`;
  return NextResponse.json({ data: { success: true, old_score, new_score, child_name: child.child_name }, summary });
}

// ── pause_automation: Log pause event for crons to check ──

async function cmdPauseAutomation(body: CommandRequest) {
  const target = body.params?.target as string; // e.g., 'practice-nudge', 'all'
  if (!target) {
    return NextResponse.json(
      { error: 'pause_automation requires params.target (cron name or "all")' },
      { status: 400 },
    );
  }

  const duration_hours = (body.params?.duration_hours as number) || 4;

  await logOpsEvent({
    event_type: 'override_applied',
    source: 'backops:pause_automation',
    severity: 'warning',
    entity_type: 'cron',
    decision_made: `pause:${target}`,
    decision_reason: {
      target,
      duration_hours,
      reason: body.reason || 'Manual pause via BackOps',
      expires_at: new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString(),
    } as Json,
    action_outcome: 'pending',
    resolved_by: 'openclaw',
  });

  const summary = `Automation paused: ${target} for ${duration_hours}h`;
  return NextResponse.json({ data: { success: true, target, duration_hours }, summary });
}

// ── resume_automation: Cancel a pause ──

async function cmdResumeAutomation(body: CommandRequest) {
  const target = body.params?.target as string;
  if (!target) {
    return NextResponse.json(
      { error: 'resume_automation requires params.target' },
      { status: 400 },
    );
  }

  await logOpsEvent({
    event_type: 'override_applied',
    source: 'backops:resume_automation',
    severity: 'info',
    entity_type: 'cron',
    decision_made: `resume:${target}`,
    decision_reason: {
      target,
      reason: body.reason || 'Resume via BackOps',
    } as Json,
    action_outcome: 'success',
    resolved_by: 'openclaw',
  });

  const summary = `Automation resumed: ${target}`;
  return NextResponse.json({ data: { success: true, target }, summary });
}

// ── send_alert: Send WhatsApp alert to admin ──

async function cmdSendAlert(body: CommandRequest) {
  const phone = body.params?.phone as string;
  const message = body.params?.message as string;
  const template = (body.params?.template as string) || 'admin_alert';

  if (!phone || !message) {
    return NextResponse.json(
      { error: 'send_alert requires params.phone and params.message' },
      { status: 400 },
    );
  }

  try {
    const result = await sendWhatsAppMessage({
      to: phone,
      templateName: template,
      variables: [message],
    });

    await logOpsEvent({
      event_type: 'communication_sent',
      source: 'backops:send_alert',
      severity: result.success ? 'info' : 'warning',
      entity_type: 'system',
      action_taken: `aisensy:${template}`,
      action_outcome: result.success ? 'success' : 'failed',
      resolved_by: 'openclaw',
      metadata: {
        phone,
        message,
        template,
        error: result.error || null,
      } as Json,
    });

    const summary = result.success
      ? `Alert sent to ${phone.slice(-4)}`
      : `Alert FAILED: ${result.error}`;

    return NextResponse.json({ data: { success: result.success }, summary });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ data: { success: false }, summary: `Alert failed: ${errorMsg}` });
  }
}

// ── update_policy: Update a backops_policies row ──

async function cmdUpdatePolicy(
  supabase: ReturnType<typeof createAdminClient>,
  body: CommandRequest,
) {
  const policy_key = body.params?.policy_key as string;
  const policy_value = body.params?.policy_value;

  if (!policy_key || !policy_value) {
    return NextResponse.json(
      { error: 'update_policy requires params.policy_key and params.policy_value' },
      { status: 400 },
    );
  }

  // Fetch current value for audit
  const { data: current } = await supabase
    .from('backops_policies')
    .select('policy_value')
    .eq('policy_key', policy_key)
    .single();

  if (!current) {
    return NextResponse.json({ error: `Policy not found: ${policy_key}` }, { status: 404 });
  }

  const { error: updateErr } = await supabase
    .from('backops_policies')
    .update({
      policy_value: policy_value as Json,
      updated_by: 'openclaw',
      updated_at: new Date().toISOString(),
    })
    .eq('policy_key', policy_key);

  if (updateErr) {
    return NextResponse.json({ error: `Update failed: ${updateErr.message}` }, { status: 500 });
  }

  invalidatePolicyCache();

  await logOpsEvent({
    event_type: 'policy_updated',
    source: 'backops:update_policy',
    severity: 'info',
    entity_type: 'system',
    decision_made: `update_policy:${policy_key}`,
    decision_reason: {
      old_value: current.policy_value as Json,
      new_value: policy_value as Json,
      reason: body.reason || 'Policy update via BackOps',
    } satisfies Record<string, Json>,
    action_outcome: 'success',
    resolved_by: 'openclaw',
  });

  const summary = `Policy updated: ${policy_key}`;
  return NextResponse.json({ data: { success: true, policy_key }, summary });
}

// ── resolve_pending: Mark a pending event as resolved ──

async function cmdResolvePending(
  supabase: ReturnType<typeof createAdminClient>,
  body: CommandRequest,
) {
  const event_id = body.params?.event_id as string;
  const resolution = (body.params?.resolution as string) || 'success';

  if (!event_id) {
    return NextResponse.json(
      { error: 'resolve_pending requires params.event_id' },
      { status: 400 },
    );
  }

  const { data: event } = await supabase
    .from('ops_events')
    .select('id, event_type, source, action_outcome')
    .eq('id', event_id)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (event.action_outcome !== 'pending') {
    return NextResponse.json(
      { error: `Event is not pending (current: ${event.action_outcome})` },
      { status: 400 },
    );
  }

  const { error: updateErr } = await supabase
    .from('ops_events')
    .update({
      action_outcome: resolution,
      resolved_by: 'openclaw',
      outcome_verified_at: new Date().toISOString(),
    })
    .eq('id', event_id);

  if (updateErr) {
    return NextResponse.json({ error: `Update failed: ${updateErr.message}` }, { status: 500 });
  }

  await logOpsEvent({
    event_type: 'action_outcome',
    source: 'backops:resolve_pending',
    severity: 'info',
    entity_type: 'system',
    decision_made: `resolve:${resolution}`,
    decision_reason: {
      original_event_id: event_id,
      original_source: event.source,
      reason: body.reason || 'Resolved via BackOps',
    } as Json,
    action_outcome: 'success',
    resolved_by: 'openclaw',
  });

  const summary = `Event ${event_id.slice(0, 8)} resolved as ${resolution}`;
  return NextResponse.json({ data: { success: true, event_id, resolution }, summary });
}
