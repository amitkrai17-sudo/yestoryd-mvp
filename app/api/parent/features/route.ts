import { NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { getChildFeatures } from '@/lib/features/get-child-features';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const supabase = getServiceSupabase();

    // Get parent
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('user_id', auth.userId!)
      .limit(1);

    if (!parent?.[0]) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    // Get parent's children
    const { data: children } = await supabase
      .from('children')
      .select('id, child_name')
      .eq('parent_id', parent[0].id);

    if (!children?.length) {
      return NextResponse.json({ children: [] });
    }

    // Resolve features for each child
    const results = await Promise.all(
      children.map(async (child) => {
        const features = await getChildFeatures(child.id);
        return { childName: child.child_name, ...features };
      })
    );

    return NextResponse.json({ children: results });
  } catch (error) {
    console.error('[parent/features] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
