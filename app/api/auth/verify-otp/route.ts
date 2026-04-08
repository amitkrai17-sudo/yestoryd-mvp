// ============================================================
// FILE: app/api/auth/verify-otp/route.ts
// ============================================================
// WhatsApp OTP Authentication - Verify OTP
//
// Supports both PARENT and COACH login
//
// Flow:
// 1. Validate input
// 2. Find token in verification_tokens
// 3. Check expiry and attempts
// 4. Verify OTP hash
// 5. Find user (parent or coach) and create session
// 6. Return session token
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/utils/phone';
import { hashOTP, secureCompare } from '@/lib/utils/otp';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import * as Sentry from '@sentry/nextjs';

const supabase = createAdminClient();

// Anon client for verifyOtp — service role key doesn't create user sessions
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

// ============================================================
// TYPES
// ============================================================

interface VerifyOTPRequest {
  phone: string;
  otp: string;
  userType?: 'parent' | 'coach';
}

interface VerifyOTPResponse {
  success: boolean;
  session?: {
    access_token: string;
    refresh_token: string;
  };
  actionLink?: string; // Fallback if server-side session creation fails
  user?: {
    id: string;
    email: string;
    phone: string;
    name: string;
  };
  redirectTo?: string;
  userType: 'parent' | 'coach';
  error?: string;
}


// ============================================================
// MAIN HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  try {
    const body: VerifyOTPRequest = await request.json();
    const { phone, otp, userType = 'parent' } = body;

    // ───────────────────────────────────────────────────────
    // STEP 1: Validate input
    // ───────────────────────────────────────────────────────
    if (!phone || !otp) {
      return NextResponse.json(
        { success: false, error: 'Phone and OTP are required' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone); // ✅ Now uses same function as send-otp
    const otpClean = otp.trim().replace(/\s/g, '');

    if (!/^\d{6}$/.test(otpClean)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid 6-digit OTP' },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] Verify OTP for ***${normalizedPhone.slice(-4)} (${userType})`);

    // ───────────────────────────────────────────────────────
    // STEP 2: Find token
    // ───────────────────────────────────────────────────────
    const { data: token, error: tokenError } = await supabase
      .from('verification_tokens')
      .select('*')
      .eq('identifier', normalizedPhone)
      .eq('identifier_type', 'phone')
      .eq('purpose', 'login')
      .is('verified_at', null)
      .single();

    if (tokenError || !token) {
      console.log(`[${requestId}] Token not found for ***${normalizedPhone.slice(-4)}`);
      return NextResponse.json(
        { success: false, error: 'OTP expired or not found. Please request a new one.' },
        { status: 400 }
      );
    }

    // ───────────────────────────────────────────────────────
    // STEP 3: Check expiry
    // ───────────────────────────────────────────────────────
    if (new Date(token.expires_at) < new Date()) {
      await supabase
        .from('verification_tokens')
        .delete()
        .eq('id', token.id);

      console.log(`[${requestId}] Token expired`);
      return NextResponse.json(
        { success: false, error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // ───────────────────────────────────────────────────────
    // STEP 4: Check attempts
    // ───────────────────────────────────────────────────────
    if ((token.attempts ?? 0) >= (token.max_attempts ?? 5)) {
      await supabase
        .from('verification_tokens')
        .delete()
        .eq('id', token.id);

      console.log(`[${requestId}] Max attempts exceeded`);
      return NextResponse.json(
        { success: false, error: 'Too many incorrect attempts. Please request a new OTP.' },
        { status: 400 }
      );
    }

    // ───────────────────────────────────────────────────────
    // STEP 5: Verify OTP (timing-safe comparison)
    // ───────────────────────────────────────────────────────
    const inputHash = hashOTP(otpClean);

    if (!secureCompare(inputHash, token.token_hash)) {
      await supabase
        .from('verification_tokens')
        .update({ attempts: (token.attempts ?? 0) + 1 })
        .eq('id', token.id);

      const attemptsLeft = (token.max_attempts ?? 5) - (token.attempts ?? 0) - 1;
      Sentry.addBreadcrumb({ category: 'auth', message: `Invalid OTP, ${attemptsLeft} attempts left`, level: 'warning', data: { requestId } });
      console.log(`[${requestId}] Invalid OTP, ${attemptsLeft} attempts left`);

      return NextResponse.json(
        {
          success: false,
          error: attemptsLeft > 0
            ? `Incorrect OTP. ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining.`
            : 'Incorrect OTP. Please request a new one.'
        },
        { status: 400 }
      );
    }

    // ───────────────────────────────────────────────────────
    // STEP 6: OTP is valid - mark as verified
    // ───────────────────────────────────────────────────────
    await supabase
      .from('verification_tokens')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', token.id);

    console.log(`[${requestId}] OTP verified successfully`);

    // ───────────────────────────────────────────────────────
    // STEP 7: Find user based on userType
    // ───────────────────────────────────────────────────────
    let user: { id: string; email: string; name: string; phone: string } | null = null;
    let redirectTo = '/parent/dashboard';
    let actualUserType = userType;

    if (userType === 'coach') {
      // ───── FIND COACH ─────
      // Use .limit(1) instead of .single() to avoid PGRST116 on duplicate phones
      const coach = await supabase
        .from('coaches')
        .select('id, email, name, phone')
        .or(`phone.eq.${normalizedPhone},phone.eq.${normalizedPhone.slice(1)},phone.eq.${normalizedPhone.slice(3)}`)
        .eq('is_active', true)
        .limit(1)
        .then(res => res.data?.[0] ?? null);

      if (coach) {
        user = {
          id: coach.id,
          email: coach.email,
          name: coach.name || 'Coach',
          phone: normalizedPhone,
        };
        redirectTo = '/coach/dashboard';

        // Update last login
        // TODO: Add last_login_at column to coaches table
        // await supabase
        //   .from('coaches')
        //   .update({ last_login_at: new Date().toISOString() })
        //   .eq('id', coach.id);

        console.log(`[${requestId}] Found coach: ${user.email}`);
      } else {
        return NextResponse.json(
          { success: false, error: 'Coach account not found' },
          { status: 404 }
        );
      }
    } else {
      // ───── FIND OR CREATE PARENT ─────
      // Use .limit(1) instead of .single() — .single() throws PGRST116
      // when duplicate phone records exist, causing login to fail entirely.
      // Prefer records that already have a user_id linked (most complete).
      let parent = await supabase
        .from('parents')
        .select('id, email, name, phone, user_id')
        .or(`phone.eq.${normalizedPhone},phone.eq.${normalizedPhone.slice(1)},phone.eq.${normalizedPhone.slice(3)}`)
        .order('user_id', { ascending: false, nullsFirst: false })
        .limit(1)
        .then(res => res.data?.[0] ?? null);

      if (!parent) {
        // Find from children table
        const child = await supabase
          .from('children')
          .select('parent_email, parent_phone, parent_name')
          .or(`parent_phone.eq.${normalizedPhone},parent_phone.eq.${normalizedPhone.slice(1)},parent_phone.eq.${normalizedPhone.slice(3)}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(res => res.data?.[0] ?? null);

        if (child && child.parent_email) {
          // Create parent record (only if we have an email)
          const { data: newParent, error: createError } = await supabase
            .from('parents')
            .insert({
              email: child.parent_email,
              name: child.parent_name || 'Parent',
              phone: normalizedPhone,
              created_at: new Date().toISOString(),
              // TODO: Add last_login_at column to parents table
              // last_login_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!createError && newParent) {
            parent = newParent;
            console.log(`[${requestId}] Created new parent: ${newParent.email}`);
          }
        }
      } else {
        // Update last login
        // TODO: Add last_login_at column to parents table
        // await supabase
        //   .from('parents')
        //   .update({ last_login_at: new Date().toISOString() })
        //   .eq('id', parent.id);
      }

      if (parent) {
        user = {
          id: parent.id,
          email: parent.email,
          name: parent.name || 'Parent',
          phone: parent.phone || normalizedPhone,
        };
        redirectTo = '/parent/dashboard';
        console.log(`[${requestId}] Found parent: ${user.email}`);
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Failed to find or create user account' },
        { status: 500 }
      );
    }

    // ───────────────────────────────────────────────────────
    // STEP 8: Ensure Supabase Auth user exists
    // ───────────────────────────────────────────────────────
    // Try to create — silently handled if user already exists
    const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
      email: user.email,
      email_confirm: true,
      phone: normalizedPhone,
      phone_confirm: true,
      user_metadata: {
        name: user.name,
        phone: normalizedPhone,
        userType: actualUserType,
      },
    });

    if (!createAuthError && newAuthUser?.user) {
      console.log(`[${requestId}] Created Supabase auth user: ${newAuthUser.user.id}`);
    } else if (createAuthError && !createAuthError.message?.includes('already been registered')) {
      Sentry.captureMessage(`createUser failed: ${createAuthError.message}`, { level: 'error', extra: { requestId, email: user.email } });
      console.error(`[${requestId}] Failed to create auth user:`, createAuthError.message);
    }

    // ───────────────────────────────────────────────────────
    // STEP 9: Generate magic link + exchange for session server-side
    // ───────────────────────────────────────────────────────
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://yestoryd.com'}${redirectTo}`,
      },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      Sentry.captureMessage(`generateLink failed for ${user.email}: ${linkError?.message || 'no hashed_token'}`, { level: 'error', extra: { requestId } });
      console.error(`[${requestId}] generateLink failed for ${user.email}:`, linkError?.message || 'no hashed_token returned');
      return NextResponse.json(
        { success: false, error: 'OTP verified but session creation failed. Please try logging in again.' },
        { status: 500 }
      );
    }

    // Link user_id and exchange token for session in parallel (independent operations)
    const authUserId = linkData.user?.id;
    const { hashed_token } = linkData.properties;

    const linkParentPromise = (authUserId && actualUserType === 'parent' && user?.id)
      ? Promise.resolve(
          supabase
            .from('parents')
            .update({ user_id: authUserId, updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .is('user_id', null)
        ).then(() => console.log(`[${requestId}] Linked parent ${user!.id} → auth user ${authUserId}`))
         .catch((linkErr: any) => {
            Sentry.captureMessage(`user_id linking failed: ${linkErr?.message}`, { level: 'error', extra: { requestId, parentId: user!.id, authUserId } });
            console.error(`[${requestId}] Failed to link parent user_id:`, linkErr);
          })
      : Promise.resolve();

    const sessionPromise = supabaseAnon.auth.verifyOtp({
      token_hash: hashed_token,
      type: 'magiclink',
    });

    const [, { data: verifyData, error: verifyError }] = await Promise.all([linkParentPromise, sessionPromise]);

    let sessionTokens: { access_token: string; refresh_token: string } | null = null;
    if (!verifyError && verifyData?.session) {
      sessionTokens = {
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
      };
      console.log(`[${requestId}] Server-side session created for ${user.email}`);
    } else {
      Sentry.captureMessage(
        `verifyOtp server-side failed for ${user.email}: ${verifyError?.message || 'no session returned'}`,
        { level: 'warning', extra: { requestId, hashedTokenPresent: !!hashed_token } }
      );
      console.warn(`[${requestId}] Server-side verifyOtp failed, falling back to actionLink:`, verifyError?.message);
    }

    // ───────────────────────────────────────────────────────
    // STEP 10: Cleanup + return session
    // ───────────────────────────────────────────────────────
    await supabase
      .from('verification_tokens')
      .delete()
      .eq('id', token.id);

    const response: VerifyOTPResponse = {
      success: true,
      ...(sessionTokens
        ? { session: sessionTokens }
        : { actionLink: linkData.properties.action_link }),
      user,
      redirectTo,
      userType: actualUserType,
    };

    console.log(`[${requestId}] Login successful for ${user.email} (${actualUserType}) [${sessionTokens ? 'direct-session' : 'actionLink-fallback'}] ${Date.now() - startTime}ms`);

    return NextResponse.json(response);

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
