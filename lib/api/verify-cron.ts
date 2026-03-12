// ============================================================
// FILE: lib/api/verify-cron.ts
// PURPOSE: Shared QStash/cron verification for all cron routes
// Supports: CRON_SECRET, internal API key, QStash Receiver
// ============================================================

import { NextRequest } from 'next/server';
import { Receiver } from '@upstash/qstash';

export interface CronAuthResult {
  isValid: boolean;
  source: 'cron_secret' | 'internal' | 'qstash' | 'none';
  error?: string;
}

/**
 * Verify a cron/QStash request via multiple auth methods.
 *
 * Checks in order:
 * 1. CRON_SECRET (Vercel cron header)
 * 2. INTERNAL_API_KEY (dispatcher → sub-cron calls)
 * 3. QStash Receiver signature verification
 *
 * @param request - The incoming NextRequest
 * @param body - Optional request body string (needed for QStash signature verification)
 */
export async function verifyCronRequest(
  request: NextRequest,
  body?: string,
): Promise<CronAuthResult> {
  // 1. Check CRON_SECRET (Vercel cron)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isValid: true, source: 'cron_secret' };
  }

  // 2. Check internal API key (dispatcher calls)
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 3. Check QStash signature
  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
      });

      const isValid = await receiver.verify({
        signature,
        body: body || '',
      });

      if (isValid) {
        return { isValid: true, source: 'qstash' };
      }
    } catch (e) {
      console.error('QStash signature verification failed:', e);
    }
  }

  return { isValid: false, source: 'none', error: 'Unauthorized: invalid cron credentials' };
}
