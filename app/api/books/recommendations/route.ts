// =============================================================================
// FILE: app/api/books/recommendations/route.ts
// PURPOSE: GET rAI book recommendations — powered by 3-layer recommendation engine
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBookRecommendations } from '@/lib/books/recommendation-engine';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Auth — parent Bearer token pattern
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const childId = request.nextUrl.searchParams.get('childId');
    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    // Verify parent owns this child
    const { data: child } = await supabase
      .from('children')
      .select('id, age')
      .eq('id', childId)
      .eq('parent_email', user.email ?? '')
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Use the 3-layer recommendation engine
    const recommendations = await getBookRecommendations(childId, 6);

    return NextResponse.json({
      success: true,
      recommendations: recommendations.map(r => ({
        ...r.book,
        recommendation_reason: r.reason,
        relevance_score: r.relevance_score,
      })),
      childAge: child.age,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[BOOK_RECOMMENDATIONS] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
