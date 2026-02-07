import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { invalidateConfigCache } from '@/lib/config/loader';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = [
  'auth', 'coach', 'payment', 'scheduling', 'revenueSplit',
  'notification', 'enrollment', 'email', 'integrations', 'pricingPlans',
] as const;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.error === 'Authentication required' ? 401 : 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const category = body.category;

    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Valid: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    invalidateConfigCache(category || undefined);

    return NextResponse.json({
      success: true,
      invalidated: category || 'all',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Config Invalidation] Error:', error);
    return NextResponse.json({ error: 'Failed to invalidate cache' }, { status: 500 });
  }
}
