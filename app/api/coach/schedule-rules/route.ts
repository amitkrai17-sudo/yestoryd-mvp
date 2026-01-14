// ============================================================================
// COACH SCHEDULE RULES API
// app/api/coach/schedule-rules/route.ts
// ============================================================================
// 
// CRUD operations for coach_schedule_rules table
// Used by CoachAvailabilityManager component
//
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// GET - Fetch schedule rules for a coach
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json(
        { success: false, error: 'Coach ID required' },
        { status: 400 }
      );
    }

    // Verify coach exists
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { success: false, error: 'Coach not found' },
        { status: 404 }
      );
    }

    // Fetch all rules for this coach
    const { data: rules, error: rulesError } = await supabase
      .from('coach_schedule_rules')
      .select('*')
      .eq('coach_id', coachId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true, nullsFirst: false })
      .order('start_time', { ascending: true });

    if (rulesError) {
      console.error('[Schedule Rules API] Error fetching rules:', rulesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch rules' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      coach: { id: coach.id, name: coach.name },
      rules: rules || [],
      count: rules?.length || 0,
    });

  } catch (error: any) {
    console.error('[Schedule Rules API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create new schedule rule(s)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      coachId,
      ruleType,
      scope,
      daysOfWeek,      // Array of day numbers for weekly rules
      specificDate,    // For date_specific rules
      startTime,
      endTime,
      reason,
      appliesTo = 'all',
    } = body;

    // Validation
    if (!coachId) {
      return NextResponse.json(
        { success: false, error: 'Coach ID required' },
        { status: 400 }
      );
    }

    if (!ruleType || !['available', 'unavailable'].includes(ruleType)) {
      return NextResponse.json(
        { success: false, error: 'Valid rule type required (available/unavailable)' },
        { status: 400 }
      );
    }

    if (!scope || !['weekly', 'date_specific'].includes(scope)) {
      return NextResponse.json(
        { success: false, error: 'Valid scope required (weekly/date_specific)' },
        { status: 400 }
      );
    }

    if (!startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Start and end time required' },
        { status: 400 }
      );
    }

    // Validate time range
    if (startTime >= endTime) {
      return NextResponse.json(
        { success: false, error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Verify coach exists
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { success: false, error: 'Coach not found' },
        { status: 404 }
      );
    }

    const createdRules = [];

    if (scope === 'weekly') {
      // Validate days of week
      if (!daysOfWeek || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one day of week required for weekly rules' },
          { status: 400 }
        );
      }

      // Create a rule for each selected day
      for (const dayOfWeek of daysOfWeek) {
        if (dayOfWeek < 0 || dayOfWeek > 6) {
          continue; // Skip invalid days
        }

        // Check for duplicate/overlapping rules
        const { data: existing } = await supabase
          .from('coach_schedule_rules')
          .select('id')
          .eq('coach_id', coachId)
          .eq('scope', 'weekly')
          .eq('day_of_week', dayOfWeek)
          .eq('rule_type', ruleType)
          .eq('start_time', startTime)
          .eq('end_time', endTime)
          .eq('is_active', true)
          .single();

        if (existing) {
          continue; // Skip duplicates
        }

        const { data: newRule, error: insertError } = await supabase
          .from('coach_schedule_rules')
          .insert({
            coach_id: coachId,
            rule_type: ruleType,
            scope: 'weekly',
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            priority: ruleType === 'unavailable' ? 20 : 10,
            applies_to: appliesTo,
            reason: reason || null,
            is_active: true,
          })
          .select()
          .single();

        if (insertError) {
          console.error('[Schedule Rules API] Insert error:', insertError);
          continue;
        }

        createdRules.push(newRule);
      }
    } else if (scope === 'date_specific') {
      // Validate specific date
      if (!specificDate) {
        return NextResponse.json(
          { success: false, error: 'Specific date required for date_specific rules' },
          { status: 400 }
        );
      }

      // Check for duplicate
      const { data: existing } = await supabase
        .from('coach_schedule_rules')
        .select('id')
        .eq('coach_id', coachId)
        .eq('scope', 'date_specific')
        .eq('specific_date', specificDate)
        .eq('rule_type', ruleType)
        .eq('is_active', true)
        .single();

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'A rule already exists for this date' },
          { status: 409 }
        );
      }

      const { data: newRule, error: insertError } = await supabase
        .from('coach_schedule_rules')
        .insert({
          coach_id: coachId,
          rule_type: ruleType,
          scope: 'date_specific',
          specific_date: specificDate,
          start_time: startTime,
          end_time: endTime,
          priority: 30, // Date-specific rules have highest priority
          applies_to: appliesTo,
          reason: reason || null,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Schedule Rules API] Insert error:', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to create rule' },
          { status: 500 }
        );
      }

      createdRules.push(newRule);
    }

    if (createdRules.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No rules were created (possibly duplicates)' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdRules.length} rule(s)`,
      rules: createdRules,
    });

  } catch (error: any) {
    console.error('[Schedule Rules API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update existing schedule rule
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      coachId,
      ruleType,
      startTime,
      endTime,
      reason,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID required' },
        { status: 400 }
      );
    }

    // Verify rule exists and belongs to coach
    const { data: existingRule, error: fetchError } = await supabase
      .from('coach_schedule_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingRule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    if (coachId && existingRule.coach_id !== coachId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Build update object
    const updates: any = { updated_at: new Date().toISOString() };
    
    if (ruleType && ['available', 'unavailable'].includes(ruleType)) {
      updates.rule_type = ruleType;
      updates.priority = ruleType === 'unavailable' ? 20 : 10;
    }
    
    if (startTime) updates.start_time = startTime;
    if (endTime) updates.end_time = endTime;
    if (reason !== undefined) updates.reason = reason || null;

    // Validate time range if both provided
    const newStartTime = updates.start_time || existingRule.start_time;
    const newEndTime = updates.end_time || existingRule.end_time;
    
    if (newStartTime >= newEndTime) {
      return NextResponse.json(
        { success: false, error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    const { data: updatedRule, error: updateError } = await supabase
      .from('coach_schedule_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[Schedule Rules API] Update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rule updated',
      rule: updatedRule,
    });

  } catch (error: any) {
    console.error('[Schedule Rules API] PUT Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Soft delete a schedule rule
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const coachId = searchParams.get('coachId');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID required' },
        { status: 400 }
      );
    }

    // Verify rule exists
    const { data: existingRule, error: fetchError } = await supabase
      .from('coach_schedule_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingRule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Optional: Verify ownership
    if (coachId && existingRule.coach_id !== coachId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Soft delete - set is_active to false
    const { error: deleteError } = await supabase
      .from('coach_schedule_rules')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      console.error('[Schedule Rules API] Delete error:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rule deleted',
    });

  } catch (error: any) {
    console.error('[Schedule Rules API] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
