// ============================================================
// GET /api/admin/payments — List payments with pagination & filters
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['all', 'captured', 'failed', 'refunded']).default('all'),
  search: z.string().max(100).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  const { searchParams } = new URL(request.url);
  const validation = QuerySchema.safeParse({
    page: searchParams.get('page') || 1,
    limit: searchParams.get('limit') || 25,
    status: searchParams.get('status') || 'all',
    search: searchParams.get('search') || undefined,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
  });

  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
  }

  const { page, limit, status, search, from, to } = validation.data;
  const offset = (page - 1) * limit;
  const supabase = getServiceSupabase();

  let query = supabase
    .from('payments')
    .select(`
      id, razorpay_order_id, razorpay_payment_id, amount, currency, status,
      captured_at, coupon_code, source, created_at,
      parent:parent_id (id, name, email, phone),
      child:child_id (id, child_name, age)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (from) {
    query = query.gte('created_at', `${from}T00:00:00`);
  }
  if (to) {
    query = query.lte('created_at', `${to}T23:59:59`);
  }

  if (search) {
    query = query.or(`razorpay_payment_id.ilike.%${search}%,razorpay_order_id.ilike.%${search}%`);
  }

  const { data: payments, count, error } = await query;

  if (error) {
    console.error(JSON.stringify({ requestId, event: 'admin_payments_error', error: error.message }));
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }

  return NextResponse.json({
    payments: payments || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}
