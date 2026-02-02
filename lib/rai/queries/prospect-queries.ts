// file: lib/rai/queries/prospect-queries.ts
// Database queries for WhatsApp prospect AI assistant
// Single source of truth — all content from DB, no hardcoding

import { supabaseAdmin } from '@/lib/supabase/server';

export async function getPricingPlans() {
  const { data, error } = await supabaseAdmin
    .from('pricing_plans')
    .select('name, slug, discounted_price, original_price, sessions_coaching, sessions_checkin, duration_months, features, description')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('[ProspectQueries] getPricingPlans error:', error);
    return null;
  }
  return data;
}

export async function getSiteSetting(key: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error) return null;
  return (data?.value as string) ?? null;
}

export async function getSiteSettings(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('key, value')
    .in('key', keys);

  if (error || !data) return {};
  return data.reduce((acc: Record<string, string>, item) => {
    acc[item.key] = String(item.value ?? '');
    return acc;
  }, {} as Record<string, string>);
}

export async function getFaqItems(): Promise<unknown | null> {
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('value')
    .eq('key', 'faq_items')
    .single();

  if (error) return null;

  // Value may be a JSON string or already parsed
  const val = data?.value;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

export async function findParentByPhone(phone: string) {
  // Normalize: keep only last 10 digits
  const normalizedPhone = phone.replace(/[^0-9]/g, '').slice(-10);

  const { data, error } = await supabaseAdmin
    .from('parents')
    .select('id, name, email, phone')
    .or(`phone.ilike.%${normalizedPhone}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Get child info
  const { data: child } = await supabaseAdmin
    .from('children')
    .select('id, name, age, latest_assessment_score, assessment_completed_at')
    .eq('parent_id', data.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get enrollment status
  let enrollmentStatus = 'Not enrolled';
  if (child) {
    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('status')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollment) {
      enrollmentStatus = enrollment.status || 'enrolled';
    }
  }

  return {
    parent: data,
    child,
    enrollmentStatus,
  };
}
