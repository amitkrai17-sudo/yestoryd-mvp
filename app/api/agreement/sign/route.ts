// file: app/api/agreement/sign/route.ts
// Save coach agreement signature
// POST /api/agreement/sign

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      coachId, 
      signatureDataUrl, 
      agreementVersion,
      taxIdType,        // 'pan' or 'aadhaar'
      taxIdValue,       // Last 4 digits only for display
      configSnapshot    // Full config at time of signing
    } = body;

    if (!coachId || !signatureDataUrl || !agreementVersion) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: coachId, signatureDataUrl, agreementVersion' },
        { status: 400 }
      );
    }

    // Get IP address and user agent from request
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Convert base64 signature to file and upload to Supabase Storage
    let signatureUrl = null;
    try {
      // Remove data URL prefix
      const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const fileName = `signatures/${coachId}_${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('coach-documents')
        .upload(fileName, buffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        console.error('Signature upload error:', uploadError);
        // Continue without storing URL - will store base64 in DB as fallback
      } else {
        const { data: urlData } = supabase.storage
          .from('coach-documents')
          .getPublicUrl(fileName);
        signatureUrl = urlData.publicUrl;
      }
    } catch (uploadErr) {
      console.error('Error processing signature:', uploadErr);
      // Will use base64 data URL as fallback
    }

    // Use uploaded URL or fallback to base64 data URL
    const finalSignatureUrl = signatureUrl || signatureDataUrl;

    // Update coach record with signature details
    const { error: updateError } = await supabase
      .from('coaches')
      .update({
        agreement_signed_at: new Date().toISOString(),
        agreement_signature_url: finalSignatureUrl,
        agreement_ip_address: ipAddress,
        agreement_user_agent: userAgent,
        agreement_version: agreementVersion,
        tax_id_type: taxIdType || null,
        aadhaar_last_four: taxIdType === 'aadhaar' ? taxIdValue : null,
      })
      .eq('id', coachId);

    if (updateError) {
      console.error('Error updating coach:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save signature to coach record' },
        { status: 500 }
      );
    }

    // Create audit log entry
    const { error: logError } = await supabase
      .from('agreement_signing_log')
      .insert({
        coach_id: coachId,
        agreement_version: agreementVersion,
        ip_address: ipAddress,
        user_agent: userAgent,
        signature_url: finalSignatureUrl,
        config_snapshot: configSnapshot || {},
      });

    if (logError) {
      console.error('Error creating signing log:', logError);
      // Non-critical error - continue
    }

    // Send confirmation email (optional)
    try {
      const { data: coachData } = await supabase
        .from('coaches')
        .select('email, name')
        .eq('id', coachId)
        .single();

      if (coachData?.email) {
        // Trigger email notification
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yestoryd.com';
        await fetch(`${baseUrl}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: coachData.email,
            subject: '✅ Agreement Signed Successfully - Yestoryd',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #7B008B;">Agreement Signed Successfully!</h2>
                <p>Hi ${coachData.name || 'Coach'},</p>
                <p>Thank you for signing the Coach Service Agreement with Yestoryd LLP.</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Agreement Version:</strong> ${agreementVersion}</p>
                  <p style="margin: 5px 0;"><strong>Signed On:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                  <p style="margin: 5px 0;"><strong>IP Address:</strong> ${ipAddress}</p>
                </div>
                <p>You can now proceed with completing your bank details to start receiving payouts.</p>
                <p>A copy of the signed agreement is available in your Coach Dashboard.</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #666; font-size: 12px;">
                  This is a system-generated email. Please do not reply.<br/>
                  For support, contact us at engage@yestoryd.com
                </p>
              </div>
            `,
          }),
        });
      }
    } catch (emailErr) {
      console.error('Error sending confirmation email:', emailErr);
      // Non-critical error - continue
    }

    return NextResponse.json({
      success: true,
      message: 'Agreement signed successfully',
      signedAt: new Date().toISOString(),
      signatureUrl: finalSignatureUrl,
    });

  } catch (error: any) {
    console.error('Error signing agreement:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sign agreement' },
      { status: 500 }
    );
  }
}
