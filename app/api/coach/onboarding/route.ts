// file: app/api/coach/onboarding/route.ts
// Save coach bank details and create Razorpay contact/fund account
// SECURITY: requireCoach() + ownership verification

import { NextRequest, NextResponse } from 'next/server';
import { requireCoach, getServiceSupabase } from '@/lib/api-auth';
import { buildEngagementRecords } from '@/lib/coach-engagement/schedule';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();
    const body = await request.json();

    const {
      coach_id,
      bank_account_number,
      bank_ifsc,
      bank_name,
      bank_account_holder,
      pan_number,
      upi_id,
    } = body;

    // Ownership check: coach can only update their own record
    if (coach_id !== auth.coachId) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify another coach\'s details' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!coach_id || !bank_account_number || !bank_ifsc || !pan_number || !bank_account_holder) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate PAN format
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_number)) {
      return NextResponse.json(
        { success: false, error: 'Invalid PAN format' },
        { status: 400 }
      );
    }

    // Get coach details
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email, phone, razorpay_contact_id')
      .eq('id', coach_id)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { success: false, error: 'Coach not found' },
        { status: 404 }
      );
    }

    // Create Razorpay Contact (if not exists)
    let razorpayContactId = coach.razorpay_contact_id;
    let razorpayFundAccountId = null;

    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const razorpayAuth = Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
      ).toString('base64');

      // Create Contact if not exists
      if (!razorpayContactId) {
        try {
          const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${razorpayAuth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: bank_account_holder,
              email: coach.email,
              contact: coach.phone || '',
              type: 'vendor',
              reference_id: coach_id,
              notes: {
                coach_name: coach.name,
                pan: pan_number,
              },
            }),
          });

          if (contactRes.ok) {
            const contactData = await contactRes.json();
            razorpayContactId = contactData.id;
            console.log('✅ Razorpay Contact created:', razorpayContactId);
          } else {
            console.error('⚠️ Razorpay Contact creation failed:', await contactRes.text());
          }
        } catch (err) {
          console.error('⚠️ Razorpay Contact error:', err);
        }
      }

      // Create Fund Account (bank account)
      if (razorpayContactId) {
        try {
          const fundRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${razorpayAuth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contact_id: razorpayContactId,
              account_type: 'bank_account',
              bank_account: {
                name: bank_account_holder,
                ifsc: bank_ifsc,
                account_number: bank_account_number,
              },
            }),
          });

          if (fundRes.ok) {
            const fundData = await fundRes.json();
            razorpayFundAccountId = fundData.id;
            console.log('✅ Razorpay Fund Account created:', razorpayFundAccountId);
          } else {
            console.error('⚠️ Razorpay Fund Account creation failed:', await fundRes.text());
          }
        } catch (err) {
          console.error('⚠️ Razorpay Fund Account error:', err);
        }
      }
    }

    // Only mark payout_enabled if Razorpay fund account was created
    const payoutEnabled = !!razorpayFundAccountId;
    const onboardingComplete = !!razorpayFundAccountId;

    // Update coach in database
    const { data: updatedCoach, error: updateError } = await supabase
      .from('coaches')
      .update({
        bank_account_number,
        bank_ifsc,
        bank_name,
        bank_account_holder,
        pan_number,
        upi_id: upi_id || null,
        razorpay_contact_id: razorpayContactId,
        razorpay_fund_account_id: razorpayFundAccountId,
        onboarding_complete: onboardingComplete,
        payout_enabled: payoutEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coach_id)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save bank details' },
        { status: 500 }
      );
    }

    // Schedule onboarding_complete engagement messages
    if (onboardingComplete) {
      const engRecords = buildEngagementRecords(coach_id, 'onboarding_complete');
      if (engRecords.length > 0) {
        await (supabase as any).from('coach_engagement_log').insert(engRecords);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bank details saved successfully',
      coach: {
        id: updatedCoach.id,
        onboarding_complete: onboardingComplete,
        payout_enabled: payoutEnabled,
        razorpay_contact_id: razorpayContactId,
        razorpay_fund_account_id: razorpayFundAccountId,
      },
    });

  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
