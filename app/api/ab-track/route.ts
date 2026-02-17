import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      test_name,
      variant,
      event_type,
      device_type,
      referrer,
    } = body;

    // Validate required fields
    if (!test_name || !variant || !event_type) {
      return NextResponse.json(
        { error: 'Missing required fields: test_name, variant, event_type' },
        { status: 400 }
      );
    }

    // Get visitor ID from cookie or generate new one
    const visitorId = request.cookies.get('yestoryd_visitor_id')?.value || 
      `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Insert tracking event
    const { data, error } = await supabase
      .from('ab_test_events')
      .insert({
        test_name,
        variant,
        event_type,
        visitor_id: visitorId,
        device_type: device_type || null,
        referrer: referrer || null,
      })
      .select()
      .single();

    if (error) {
      console.error('AB tracking error:', error);
      return NextResponse.json(
        { error: 'Failed to track event' },
        { status: 500 }
      );
    }

    // Create response with visitor ID cookie if new
    const response = NextResponse.json({ 
      success: true, 
      event_id: data.id 
    });

    // Set visitor ID cookie if not already set
    if (!request.cookies.get('yestoryd_visitor_id')) {
      response.cookies.set('yestoryd_visitor_id', visitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/',
      });
    }

    return response;

  } catch (error) {
    console.error('AB tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve A/B test results (for admin dashboard)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testName = searchParams.get('test_name');

    if (!testName) {
      return NextResponse.json(
        { error: 'Missing test_name parameter' },
        { status: 400 }
      );
    }

    // Get aggregated results
    const { data: events, error } = await supabase
      .from('ab_test_events')
      .select('variant, event_type')
      .eq('test_name', testName);

    if (error) {
      console.error('AB results error:', error);
      return NextResponse.json(
        { error: 'Failed to get results' },
        { status: 500 }
      );
    }

    // Aggregate results
    const results: Record<string, Record<string, number>> = {};
    
    events?.forEach(event => {
      if (!results[event.variant]) {
        results[event.variant] = {};
      }
      if (!results[event.variant][event.event_type]) {
        results[event.variant][event.event_type] = 0;
      }
      results[event.variant][event.event_type]++;
    });

    // Calculate conversion rates
    const analysis: Record<string, {
      views: number;
      clicks: number;
      conversion_rate: number;
    }> = {};

    Object.entries(results).forEach(([variant, eventCounts]) => {
      const views = eventCounts['view'] || 0;
      const clicks = eventCounts['cta_click'] || 0;
      analysis[variant] = {
        views,
        clicks,
        conversion_rate: views > 0 ? (clicks / views) * 100 : 0,
      };
    });

    return NextResponse.json({
      test_name: testName,
      results: analysis,
      raw_data: results,
      total_events: events?.length || 0,
    });

  } catch (error) {
    console.error('AB results error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
