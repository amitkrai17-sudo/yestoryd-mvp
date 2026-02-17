// ============================================================
// FILE: app/api/auth/send-otp/route.ts
// ============================================================
// WhatsApp OTP Authentication - Send OTP
// 
// Supports both PARENT and COACH login
// 
// Flow:
// 1. Validate phone number format
// 2. Check rate limiting (max 5 OTPs per hour)
// 3. Find user in parents/children OR coaches table
// 4. Generate 6-digit OTP
// 5. Store hashed OTP in verification_tokens
// 6. Send via WhatsApp (AiSensy) with email fallback
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { isValidPhone, normalizePhone } from '@/lib/utils/phone';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// Service Supabase client (bypasses RLS)
// ============================================================
// TYPES
// ============================================================

interface SendOTPRequest {
  phone: string;
  method?: 'whatsapp' | 'email';
  userType?: 'parent' | 'coach'; // NEW: Specify user type
}

interface SendOTPResponse {
  success: boolean;
  method: 'whatsapp' | 'email';
  message: string;
  expiresIn: number;
  isNewUser?: boolean;
  userType: 'parent' | 'coach';
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Using central phone utility - normalizePhone imported from lib/utils/phone

// Using central phone utility

function generateOTP(): string {
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  const otp = (num % 900000) + 100000;
  return otp.toString();
}

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

async function sendWhatsAppOTP(phone: string, otp: string): Promise<boolean> {
  const apiKey = process.env.AISENSY_API_KEY;
  const baseUrl = process.env.AISENSY_BASE_URL || 'https://backend.aisensy.com/campaign/t1/api/v2';
  
  if (!apiKey) {
    console.error('[OTP] AISENSY_API_KEY not configured');
    return false;
  }
  
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        campaignName: 'auth_otp',
        destination: phone,
        userName: 'Yestoryd LLP',
        source: 'new-landing-page form',
        templateParams: [otp],
        buttons: [
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [
              {
                type: 'text',
                text: otp
              }
            ]
          }
        ],
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && (data.success === 'true' || data.success === true || data.status === 'success' || data.status === 'submitted')) {
      console.log(`[OTP] WhatsApp sent to ${phone.slice(-4)}`);
      return true;
    }
    
    console.error('[OTP] AiSensy error:', data);
    return false;
  } catch (error) {
    console.error('[OTP] WhatsApp send failed:', error);
    return false;
  }
}

async function sendEmailOTP(email: string, otp: string): Promise<boolean> {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  
  if (!sendgridKey) {
    console.error('[OTP] SENDGRID_API_KEY not configured');
    return false;
  }
  
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email }],
          subject: `Your Yestoryd verification code: ${otp}`,
        }],
        from: { 
          email: process.env.SENDGRID_FROM_EMAIL || 'engage@yestoryd.com',
          name: 'Yestoryd'
        },
        content: [{
          type: 'text/html',
          value: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #FF0099;">Yestoryd Verification Code</h2>
              <p>Your verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #333; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center;">
                ${otp}
              </div>
              <p style="color: #666; margin-top: 20px;">This code expires in 5 minutes.</p>
              <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
            </div>
          `,
        }],
      }),
    });
    
    if (response.ok) {
      console.log(`[OTP] Email sent to ${email}`);
      return true;
    }
    
    console.error('[OTP] SendGrid error:', await response.text());
    return false;
  } catch (error) {
    console.error('[OTP] Email send failed:', error);
    return false;
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  
  try {
    const body: SendOTPRequest = await request.json();
    const { phone, method = 'whatsapp', userType = 'parent' } = body;
    
    // ─────────────────────────────────────────────────────────
    // STEP 1: Validate phone
    // ─────────────────────────────────────────────────────────
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }
    
    const normalizedPhone = normalizePhone(phone);
    
    if (!isValidPhone(normalizedPhone)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid 10-digit Indian mobile number' },
        { status: 400 }
      );
    }
    
    console.log(`[${requestId}] OTP request for ${normalizedPhone.slice(-4)} (${userType})`);
    
    // ─────────────────────────────────────────────────────────
    // STEP 2: Rate limiting (max 5 per hour)
    // ─────────────────────────────────────────────────────────
    const { data: rateLimit } = await supabase
      .from('verification_tokens')
      .select('id')
      .eq('identifier', normalizedPhone)
      .eq('identifier_type', 'phone')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    if (rateLimit && rateLimit.length >= 5) {
      console.log(`[${requestId}] Rate limited: ${normalizedPhone.slice(-4)}`);
      return NextResponse.json(
        { success: false, error: 'Too many OTP requests. Please try again in an hour.' },
        { status: 429 }
      );
    }
    
    // ─────────────────────────────────────────────────────────
    // STEP 3: Find user based on userType
    // ─────────────────────────────────────────────────────────
    let userEmail: string | null = null;
    let isNewUser = false;
    let actualUserType = userType;
    
    if (userType === 'coach') {
      // ───── COACH LOOKUP ─────
      const { data: coach } = await supabase
        .from('coaches')
        .select('id, email, phone, name')
        .or(`phone.eq.${normalizedPhone},phone.eq.+${normalizedPhone},phone.eq.${normalizedPhone.slice(2)}`)
        .eq('is_active', true)
        .single();
      
      if (coach) {
        userEmail = coach.email;
        console.log(`[${requestId}] Found coach: ${userEmail}`);
      } else {
        return NextResponse.json(
          { 
            success: false, 
            error: 'This phone number is not registered as a coach.',
            code: 'COACH_NOT_FOUND'
          },
          { status: 404 }
        );
      }
    } else {
      // ───── PARENT LOOKUP ─────
      // Check parents table first
      const { data: parent } = await supabase
        .from('parents')
        .select('id, email, phone')
        .eq('phone', normalizedPhone)
        .single();
      
      if (parent) {
        userEmail = parent.email;
        console.log(`[${requestId}] Found parent: ${userEmail}`);
      } else {
        // Check children table (parent_phone)
        const { data: child } = await supabase
          .from('children')
          .select('parent_email, parent_phone, parent_name')
          .eq('parent_phone', normalizedPhone)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (child) {
          userEmail = child.parent_email;
          isNewUser = true;
          console.log(`[${requestId}] Found in children, will create parent: ${userEmail}`);
        }
      }
      
      if (!userEmail) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'This phone number is not registered. Please complete an assessment first.',
            code: 'PHONE_NOT_FOUND'
          },
          { status: 404 }
        );
      }
    }
    
    // ─────────────────────────────────────────────────────────
    // STEP 4: Generate and store OTP
    // ─────────────────────────────────────────────────────────
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    // Delete any existing tokens for this phone
    await supabase
      .from('verification_tokens')
      .delete()
      .eq('identifier', normalizedPhone)
      .eq('identifier_type', 'phone')
      .eq('purpose', 'login');
    
    // Insert new token
    const { error: insertError } = await supabase
      .from('verification_tokens')
      .insert({
        identifier: normalizedPhone,
        identifier_type: 'phone',
        token_hash: otpHash,
        purpose: 'login',
        expires_at: expiresAt.toISOString(),
      });
    
    if (insertError) {
      console.error(`[${requestId}] Failed to store OTP:`, insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to generate OTP. Please try again.' },
        { status: 500 }
      );
    }
    
    // ─────────────────────────────────────────────────────────
    // STEP 5: Send OTP (WhatsApp primary, email fallback)
    // ─────────────────────────────────────────────────────────
    let sendMethod: 'whatsapp' | 'email' = method;
    let sent = false;
    
    if (method === 'whatsapp') {
      sent = await sendWhatsAppOTP(normalizedPhone, otp);
      
      if (!sent && userEmail) {
        console.log(`[${requestId}] WhatsApp failed, falling back to email`);
        sent = await sendEmailOTP(userEmail, otp);
        sendMethod = 'email';
      }
    } else {
      if (userEmail) {
        sent = await sendEmailOTP(userEmail, otp);
      }
    }
    
    if (!sent) {
      await supabase
        .from('verification_tokens')
        .delete()
        .eq('identifier', normalizedPhone)
        .eq('token_hash', otpHash);
      
      return NextResponse.json(
        { success: false, error: 'Failed to send OTP. Please try again.' },
        { status: 500 }
      );
    }
    
    // ─────────────────────────────────────────────────────────
    // STEP 6: Return success
    // ─────────────────────────────────────────────────────────
    const response: SendOTPResponse = {
      success: true,
      method: sendMethod,
      message: sendMethod === 'whatsapp' 
        ? 'OTP sent to your WhatsApp' 
        : 'OTP sent to your email',
      expiresIn: 300,
      isNewUser,
      userType: actualUserType,
    };
    
    console.log(`[${requestId}] OTP sent via ${sendMethod} for ${actualUserType}`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
