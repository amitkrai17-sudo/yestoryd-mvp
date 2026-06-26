// ============================================================
// FILE: lib/communication/idempotency.ts
// PURPOSE: The SINGLE atomic-idempotency implementation, reused by BOTH
//   notify.ts (Spine-1, 2A) AND sendCommunication (Spine-2 opt-in, 2C). Do NOT
//   fork a second copy. Extracted verbatim from notify.ts STEP-6 so the key is
//   byte-identical to the live 2A/2B reminder dedup.
// ============================================================

import crypto from 'crypto';

type CommClient = ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** YYYY-MM-DD in Asia/Kolkata — the legacy key's day bucket. */
function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export interface ComposeKeyParams {
  templateCode: string;
  phone: string;
  firstParam: string;
  /** template.dedup_scope?.fields — when present AND every field resolves, the key
   *  is (templateCode:<field values>); otherwise the legacy phone:day:firstParam key. */
  dedupScope?: string[] | null;
  meta?: Record<string, unknown> | null;
  salt?: string | null;
}

/**
 * Compose the sha256 idempotency key. BYTE-IDENTICAL to the pre-2C notify.ts STEP-6
 * formula (legacy phone:day:firstParam[:ctx][:salt], or the dedup_scope tuple).
 * `usedScope` is true ONLY when a dedup_scope is present AND every field resolves in
 * meta — Spine-2 gates its opt-in claim on that flag.
 */
export function composeIdempotencyKey(p: ComposeKeyParams): { key: string; usedScope: boolean } {
  const ctx = p.meta?.contextId as string | undefined;
  const legacyBase = ctx
    ? `${p.templateCode}:${p.phone}:${todayIST()}:${p.firstParam}:${ctx}`
    : `${p.templateCode}:${p.phone}:${todayIST()}:${p.firstParam}`;

  let base = legacyBase;
  let usedScope = false;
  const scopeFields = p.dedupScope;
  if (scopeFields?.length) {
    const metaRecord = (p.meta ?? {}) as Record<string, unknown>;
    const vals = scopeFields.map((f) => metaRecord[f]);
    if (vals.some((v) => v === undefined || v === null || v === '')) {
      console.error('[idempotency] dedup_scope field missing — falling back to legacy key', JSON.stringify({ templateCode: p.templateCode, scope: scopeFields }));
      base = legacyBase;
    } else {
      base = `${p.templateCode}:${vals.join(':')}`;
      usedScope = true;
    }
  }
  const input = p.salt ? `${base}:${p.salt}` : base;
  const key = crypto.createHash('sha256').update(input).digest('hex');
  return { key, usedScope };
}

export interface ClaimResult {
  claimId: string | null;
  duplicate: boolean;
  error: string | null;
}

/**
 * Atomic claim: INSERT the keyed communication_logs row ON CONFLICT(idempotency_key)
 * DO NOTHING. Returns claimId on a fresh claim, duplicate:true when the key was already
 * claimed (a concurrent/earlier send won), or error on infra failure. The SOLE pre-send
 * dedup gate (the FULL UNIQUE(idempotency_key) constraint, migration 20260416120000).
 */
export async function claimIdempotencyRow(
  supabase: CommClient,
  row: Record<string, unknown>,
): Promise<ClaimResult> {
  const { data, error } = await supabase
    .from('communication_logs')
    .upsert(row as never, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    .select('id');
  if (error) return { claimId: null, duplicate: false, error: error.message };
  if (!data || data.length === 0) return { claimId: null, duplicate: true, error: null };
  return { claimId: (data[0] as { id: string }).id, duplicate: false, error: null };
}

/** Release a claim: NULL the key so a retry can re-claim; keep the row as a failure audit. */
export async function releaseIdempotencyRow(
  supabase: CommClient,
  claimId: string,
  errorMessage: string | null,
): Promise<void> {
  await supabase
    .from('communication_logs')
    .update({ idempotency_key: null, error_message: errorMessage })
    .eq('id', claimId);
}
