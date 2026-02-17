// ============================================================
// FILE: lib/admin-fetch.ts
// ============================================================
// Authenticated fetch wrapper for admin API calls
// Automatically includes auth token from Supabase session
// ============================================================

import { supabase } from '@/lib/supabase/client';

/**
 * Fetch wrapper that automatically includes auth token
 */
export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers);
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * GET request with auth
 */
export async function adminGet(url: string): Promise<Response> {
  return adminFetch(url, { method: 'GET' });
}

/**
 * POST request with auth
 */
export async function adminPost(url: string, body: any): Promise<Response> {
  return adminFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
