// ============================================================
// FILE: lib/backops/auth.ts
// PURPOSE: API key verification for BackOps endpoints.
//          Used by /api/backops/* routes.
//          Key is set via BACKOPS_API_KEY env var.
// ============================================================

import { NextRequest } from 'next/server';

export interface BackOpsAuthResult {
  isValid: boolean;
  source: 'backops_key' | 'none';
  error?: string;
}

/**
 * Verify a BackOps API request via x-backops-key header.
 */
export function verifyBackOpsAuth(request: NextRequest): BackOpsAuthResult {
  const key = request.headers.get('x-backops-key');
  const expected = process.env.BACKOPS_API_KEY;

  if (!expected) {
    return { isValid: false, source: 'none', error: 'BACKOPS_API_KEY not configured' };
  }

  if (!key || key !== expected) {
    return { isValid: false, source: 'none', error: 'Invalid or missing x-backops-key' };
  }

  return { isValid: true, source: 'backops_key' };
}
