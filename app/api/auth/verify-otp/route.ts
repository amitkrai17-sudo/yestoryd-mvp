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
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/utils/phone'; // ✅ USE CENTRALIZED FUNCTION
import crypto from 'crypto';

// Service Supabase client (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  accessToken?: string;
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
// HELPER FUNCTIONS
// ============================================================

// ❌ REMOVED: Local normalizePhone - now using centralized version from @/lib/utils/phone

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

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

    console.log(`[${requestId}] Verify OTP for ${normalizedPhone.slice(-4)} (${userType})`);
    console.log(`[${requestId}] Looking for identifier: ${normalizedPhone}`); // Debug log

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
      console.log(`[${requestId}] Token not found for identifier: ${normalizedPhone}`);
      
      // Debug: Check what tokens exist for this phone (last 4 digits match)
      const { data: debugTokens } = await supabase
        .from('verification_tokens')
        .select('identifier, created_at, expires_at')
        .like('identifier', `%${normalizedPhone.slice(-4)}`)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (debugTokens && debugTokens.length > 0) {
        console.log(`[${requestId}] Found tokens with similar phones:`, debugTokens.map(t => t.identifier));
      }
      
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
    if (token.attempts >= token.max_attempts) {
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
        .update({ attempts: token.attempts + 1 })
        .eq('id', token.id);

      const attemptsLeft = token.max_attempts - token.attempts - 1;
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
      const { data: coach } = await supabase
        .from('coaches')
        .select('id, email, name, phone')
        .or(`phone.eq.${normalizedPhone},phone.eq.+${normalizedPhone},phone.eq.${normalizedPhone.slice(2)}`)
        .eq('is_active', true)
        .single();

      if (coach) {
        user = {
          id: coach.id,
          email: coach.email,
          name: coach.name || 'Coach',
          phone: normalizedPhone,
        };
        redirectTo = '/coach/dashboard';

        // Update last login
        await supabase
          .from('coaches')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', coach.id);

        console.log(`[${requestId}] Found coach: ${user.email}`);
      } else {
        return NextResponse.json(
          { success: false, error: 'Coach account not found' },
          { status: 404 }
        );
      }
    } else {
      // ───── FIND OR CREATE PARENT ─────
      let parent = await supabase
        .from('parents')
        .select('id, email, name, phone')
        .eq('phone', normalizedPhone)
        .single()
        .then(res => res.data);

      if (!parent) {
        // Find from children table
        const { data: child } = await supabase
          .from('children')
          .select('parent_email, parent_phone, parent_name')
          .eq('parent_phone', normalizedPhone)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (child) {
          // Create parent record
          const { data: newParent, error: createError } = await supabase
            .from('parents')
            .insert({
              email: child.parent_email,
              name: child.parent_name || 'Parent',
              phone: normalizedPhone,
              created_at: new Date().toISOString(),
              last_login_at: new Date().toISOString(),
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
        await supabase
          .from('parents')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', parent.id);
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
    // STEP 8: Create Supabase Auth session
    // ───────────────────────────────────────────────────────
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
    let supabaseUser = authUser?.users?.find(u => u.email === user!.email);

    if (!supabaseUser) {
      // Create auth user if doesn't exist
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

      if (!createAuthError) {
        supabaseUser = newAuthUser.user;
        console.log(`[${requestId}] Created Supabase auth user`);
      }
    }

    // Generate magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://yestoryd.com'}${redirectTo}`,
      },
    });

    if (linkError) {
      console.error(`[${requestId}] Failed to generate session:`, linkError);

      // Fallback: Return user info and let frontend handle redirect
      return NextResponse.json({
        success: true,
        user,
        redirectTo,
        userType: actualUserType,
        message: 'Verified successfully. Redirecting...',
      });
    }

    // ───────────────────────────────────────────────────────
    // STEP 9: Cleanup - delete used token
    // ───────────────────────────────────────────────────────
    await supabase
      .from('verification_tokens')
      .delete()
      .eq('id', token.id);

    // ───────────────────────────────────────────────────────
    // STEP 10: Return session
    // ───────────────────────────────────────────────────────
    const response: VerifyOTPResponse = {
      success: true,
      user,
      redirectTo,
      userType: actualUserType,
    };

    if (linkData?.properties?.action_link) {
      response.accessToken = linkData.properties.action_link;
    }

    console.log(`[${requestId}] Login successful for ${user.email} (${actualUserType})`);

    return NextResponse.json(response);

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
