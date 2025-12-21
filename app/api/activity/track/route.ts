// file: app/api/activity/track/route.ts
// Track user activity - last seen, login count, page views

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ActivityRequest {
  userType: 'parent' | 'coach' | 'admin';
  userEmail: string;
  action: 'login' | 'page_view' | 'logout' | 'chat';
  pagePath?: string;
  metadata?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const body: ActivityRequest = await request.json();

    if (!body.userEmail || !body.userType || !body.action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Log activity
    await supabase.from('activity_log').insert({
      user_type: body.userType,
      user_email: body.userEmail,
      action: body.action,
      page_path: body.pagePath,
      metadata: body.metadata,
    });

    // Update last_seen and login_count based on user type
    if (body.userType === 'coach') {
      if (body.action === 'login') {
        // Get current login count and increment
        const { data: coach } = await supabase
          .from('coaches')
          .select('total_login_count')
          .eq('email', body.userEmail)
          .single();
        
        const currentCount = coach?.total_login_count || 0;
        
        await supabase
          .from('coaches')
          .update({ 
            last_seen_at: now,
            total_login_count: currentCount + 1
          })
          .eq('email', body.userEmail);
      } else {
        // Just update last_seen for other actions
        await supabase
          .from('coaches')
          .update({ last_seen_at: now })
          .eq('email', body.userEmail);
      }

    } else if (body.userType === 'parent') {
      if (body.action === 'login') {
        // Get current login count and increment
        const { data: parent } = await supabase
          .from('parents')
          .select('total_login_count')
          .eq('email', body.userEmail)
          .single();
        
        const currentCount = parent?.total_login_count || 0;
        
        await supabase
          .from('parents')
          .update({ 
            last_seen_at: now,
            total_login_count: currentCount + 1
          })
          .eq('email', body.userEmail);
      } else {
        // Just update last_seen for other actions
        await supabase
          .from('parents')
          .update({ last_seen_at: now })
          .eq('email', body.userEmail);
      }
    }

    return NextResponse.json({ 
      success: true,
      timestamp: now,
    });

  } catch (error) {
    console.error('Activity tracking error:', error);
    // Don't fail silently - activity tracking shouldn't break the app
    return NextResponse.json({ success: true });
  }
}

// GET: Get activity summary for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const userType = searchParams.get('userType');
    const days = parseInt(searchParams.get('days') || '7');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    // Get activity logs
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: logs } = await supabase
      .from('activity_log')
      .select('action, page_path, created_at')
      .eq('user_email', email)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    // Get user profile with activity data
    let profile = null;
    if (userType === 'coach') {
      const { data } = await supabase
        .from('coaches')
        .select('name, email, last_seen_at, total_login_count, is_available')
        .eq('email', email)
        .single();
      profile = data;
    } else if (userType === 'parent') {
      const { data } = await supabase
        .from('parents')
        .select('name, email, last_seen_at, total_login_count')
        .eq('email', email)
        .single();
      profile = data;
    }

    // Calculate stats
    const loginCount = logs?.filter(l => l.action === 'login').length || 0;
    const pageViews = logs?.filter(l => l.action === 'page_view').length || 0;
    const uniquePages = [...new Set(logs?.map(l => l.page_path).filter(Boolean))].length;

    return NextResponse.json({
      profile,
      stats: {
        logins_last_n_days: loginCount,
        page_views: pageViews,
        unique_pages: uniquePages,
      },
      recent_activity: logs?.slice(0, 20),
    });

  } catch (error) {
    console.error('Get activity error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}