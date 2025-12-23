// file: app/api/agreement/sign/route.ts
// Sign agreement and store signature
// POST /api/agreement/sign

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      coachId,
      agreementVersionId,
      signature,
      taxIdType,
      taxIdValue,
      agreementVersion
    } = body;

    // Validation
    if (!coachId || !signature || !taxIdValue) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get request metadata
    const headersList = headers();
    const ipAddress = headersList.get('x-forwarded-for') || 
                      headersList.get('x-real-ip') || 
                      'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Upload signature to Supabase Storage
    const timestamp = Date.now();
    const signaturePath = `signatures/${coachId}-${timestamp}.png`;
    
    // Convert base64 to buffer
    const base64Data = signature.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('coach-documents')
      .upload(signaturePath, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('Signature upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to save signature' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('coach-documents')
      .getPublicUrl(signaturePath);

    const signatureUrl = urlData.publicUrl;

    // Update coach record
    const updateData: any = {
      agreement_signed_at: new Date().toISOString(),
      agreement_signature_url: signatureUrl,
      agreement_ip_address: ipAddress,
      agreement_user_agent: userAgent,
      agreement_version: agreementVersion || '2.1',
      payout_active: true // Activate payout after signing
    };

    // Add tax ID based on type
    if (taxIdType === 'pan') {
      updateData.pan_number = taxIdValue;
    } else {
      updateData.aadhaar_number = taxIdValue;
    }

    // Add agreement version reference if provided
    if (agreementVersionId) {
      updateData.agreement_version_id = agreementVersionId;
    }

    const { data: coach, error: updateError } = await supabase
      .from('coaches')
      .update(updateData)
      .eq('id', coachId)
      .select('id, name, email, agreement_version')
      .single();

    if (updateError) {
      console.error('Coach update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update coach record' },
        { status: 500 }
      );
    }

    // Create audit log entry
    const { error: logError } = await supabase
      .from('agreement_signing_log')
      .insert({
        coach_id: coachId,
        agreement_version_id: agreementVersionId,
        agreement_version: agreementVersion || '2.1',
        signature_url: signatureUrl,
        tax_id_type: taxIdType,
        tax_id_masked: taxIdType === 'pan' 
          ? taxIdValue.substring(0, 5) + '****' + taxIdValue.substring(9)
          : '****' + taxIdValue.substring(8),
        ip_address: ipAddress,
        user_agent: userAgent,
        signed_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Audit log error:', logError);
      // Don't fail the request for audit log errors
    }

    // Send confirmation email
    try {
      await sendConfirmationEmail(coach, agreementVersion || '2.1', signatureUrl);
    } catch (emailError) {
      console.error('Email error:', emailError);
      // Don't fail the request for email errors
    }

    return NextResponse.json({
      success: true,
      message: 'Agreement signed successfully',
      signatureUrl,
      emailSent: true
    });

  } catch (error) {
    console.error('Sign error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Send confirmation email
async function sendConfirmationEmail(
  coach: { id: string; name: string; email: string },
  version: string,
  signatureUrl: string
) {
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  if (!SENDGRID_API_KEY) return;

  const referralCode = coach.id.substring(0, 8).toUpperCase();
  const referralLink = `https://yestoryd.com/coach-apply?ref=${referralCode}`;
  const dashboardLink = 'https://yestoryd.com/coach/dashboard';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #FF0099 0%, #7B008B 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎉 Welcome to Yestoryd!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your Coach Agreement is Active</p>
          </td>
        </tr>
        
        <!-- Content -->
        <tr>
          <td style="padding: 30px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Hi <strong>${coach.name}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Congratulations! You have successfully signed the Coach Service Agreement. 
              You're now officially part of the Yestoryd coaching team! 🚀
            </p>
            
            <!-- Agreement Details Box -->
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 15px 0; color: #333;">📋 Agreement Details</h3>
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 5px 0; color: #666;">Version:</td>
                  <td style="padding: 5px 0; color: #333; font-weight: bold;">v${version}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Signed On:</td>
                  <td style="padding: 5px 0; color: #333; font-weight: bold;">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Status:</td>
                  <td style="padding: 5px 0; color: #22c55e; font-weight: bold;">✅ Active</td>
                </tr>
              </table>
            </div>
            
            <!-- Earnings Box -->
            <div style="background: linear-gradient(135deg, #FFF0F5 0%, #F0E6FF 100%); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 15px 0; color: #7B008B;">💰 Your Earnings Potential</h3>
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Yestoryd-sourced student:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">₹3,000 (50%)</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Your referral student:</td>
                  <td style="padding: 8px 0; color: #FF0099; font-weight: bold; text-align: right;">₹4,200 (70%)</td>
                </tr>
              </table>
            </div>
            
            <!-- Referral Link -->
            <div style="background-color: #FF0099; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
              <p style="color: #ffffff; margin: 0 0 10px 0; font-weight: bold;">🔗 Your Referral Link</p>
              <p style="color: #ffffff; margin: 0; font-size: 14px; word-break: break-all;">
                ${referralLink}
              </p>
              <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0; font-size: 12px;">
                Share this link to earn 70% on every enrollment!
              </p>
            </div>
            
            <!-- Next Steps -->
            <h3 style="color: #333; margin-bottom: 15px;">📌 Next Steps</h3>
            <ol style="color: #666; padding-left: 20px; margin-bottom: 20px;">
              <li style="margin-bottom: 10px;">Complete your bank details in the dashboard (if not done)</li>
              <li style="margin-bottom: 10px;">Share your referral link with parents you know</li>
              <li style="margin-bottom: 10px;">Wait for student assignment - we'll notify you!</li>
            </ol>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardLink}" style="background: linear-gradient(135deg, #FF0099 0%, #7B008B 100%); color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Go to Dashboard →
              </a>
            </div>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
              <strong>Yestoryd</strong> | AI-Powered Reading Intelligence Platform
            </p>
            <p style="color: #999; font-size: 12px; margin: 0;">
              Questions? Reply to this email or WhatsApp us at +91 8976287997
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: coach.email }] }],
      from: { email: 'engage@yestoryd.com', name: 'Yestoryd' },
      subject: '🎉 Welcome to Yestoryd! Your Coach Agreement is Active',
      content: [{ type: 'text/html', value: emailHtml }]
    })
  });
}
