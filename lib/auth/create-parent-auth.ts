// ============================================================
// Create Supabase auth account for a parent and link user_id
// lib/auth/create-parent-auth.ts
//
// Called from:
//   - verify-otp (after OTP login)
//   - getOrCreateParent (payment flows)
//   - tuition onboarding
//   - backfill script
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

interface CreateParentAuthParams {
  parentId: string;
  phone: string;
  email?: string | null;
  name?: string | null;
}

interface CreateParentAuthResult {
  userId: string | null;
  created: boolean;
  error?: string;
}

/**
 * Ensure a parent has a Supabase auth account and parents.user_id is linked.
 *
 * - If auth user already exists for this email → link it
 * - If not → create one via auth.admin.createUser
 * - Updates parents.user_id with the auth user ID
 * - Idempotent: safe to call multiple times
 */
export async function ensureParentAuthAccount(
  params: CreateParentAuthParams
): Promise<CreateParentAuthResult> {
  const { parentId, phone, email, name } = params;
  const supabase = createAdminClient();

  try {
    // 1. Check if parent already has user_id
    const { data: parent } = await supabase
      .from('parents')
      .select('user_id')
      .eq('id', parentId)
      .single();

    if (parent?.user_id) {
      return { userId: parent.user_id, created: false };
    }

    // 2. Need an email for Supabase auth (phone-only auth is limited)
    const authEmail = email || `parent_${phone.replace(/\D/g, '')}@auth.yestoryd.com`;

    // 3. Check if auth user already exists for this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let authUser = existingUsers?.users?.find(
      u => u.email === authEmail || u.phone === phone
    );

    if (!authUser) {
      // 4. Create auth user
      const { data: newAuth, error: createError } = await supabase.auth.admin.createUser({
        email: authEmail,
        email_confirm: true,
        phone,
        phone_confirm: true,
        user_metadata: {
          name: name || 'Parent',
          phone,
          userType: 'parent',
        },
      });

      if (createError) {
        console.error(`[createParentAuth] Failed to create auth user for parent ${parentId}:`, createError.message);
        return { userId: null, created: false, error: createError.message };
      }

      authUser = newAuth.user;
    }

    // 5. Link: update parents.user_id
    if (authUser?.id) {
      const { error: linkError } = await supabase
        .from('parents')
        .update({ user_id: authUser.id, updated_at: new Date().toISOString() })
        .eq('id', parentId);

      if (linkError) {
        console.error(`[createParentAuth] Failed to link user_id for parent ${parentId}:`, linkError.message);
        return { userId: authUser.id, created: true, error: `Link failed: ${linkError.message}` };
      }

      console.log(`[createParentAuth] Linked parent ${parentId} → auth user ${authUser.id}`);
      return { userId: authUser.id, created: !existingUsers?.users?.find(u => u.id === authUser!.id) };
    }

    return { userId: null, created: false, error: 'No auth user ID returned' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[createParentAuth] Error for parent ${parentId}:`, message);
    return { userId: null, created: false, error: message };
  }
}
