// file: app/api/agreement/sign/route.ts
// Save coach agreement signature + Send branded email with PDF attachment
// POST /api/agreement/sign

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Generate PDF content as base64
async function generateAgreementPDF(data: {
  coachName: string;
  coachEmail: string;
  agreementVersion: string;
  signedAt: string;
  ipAddress: string;
  taxIdType: string;
  signatureDataUrl: string;
  configSnapshot: any;
}): Promise<string> {
  // Create HTML content for PDF
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
    .header { text-align: center; border-bottom: 3px solid #7B008B; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: bold; color: #7B008B; }
    .logo span { color: #FF0099; }
    .title { font-size: 22px; color: #333; margin-top: 10px; }
    .section { margin: 25px 0; }
    .section-title { font-size: 16px; font-weight: bold; color: #7B008B; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; }
    .info-row { display: flex; margin: 8px 0; }
    .info-label { font-weight: 600; width: 180px; color: #555; }
    .info-value { color: #333; }
    .highlight-box { background: linear-gradient(135deg, #fdf4ff, #fce7f3); border: 1px solid #f0abfc; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .signature-section { margin-top: 40px; padding-top: 20px; border-top: 2px solid #7B008B; }
    .signature-img { max-width: 250px; max-height: 80px; border: 1px solid #ddd; padding: 10px; background: #fafafa; }
    .terms-summary { font-size: 12px; color: #666; margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Yester<span>yd</span></div>
    <div class="title">COACH SERVICE AGREEMENT</div>
    <div style="font-size: 12px; color: #666;">Executed Copy - Legally Binding Document</div>
  </div>

  <div class="section">
    <div class="section-title">PARTIES TO THE AGREEMENT</div>
    <div class="info-row"><span class="info-label">Company:</span><span class="info-value">Yestoryd LLP</span></div>
    <div class="info-row"><span class="info-label">Coach Name:</span><span class="info-value">${data.coachName}</span></div>
    <div class="info-row"><span class="info-label">Coach Email:</span><span class="info-value">${data.coachEmail}</span></div>
  </div>

  <div class="section">
    <div class="section-title">AGREEMENT DETAILS</div>
    <div class="info-row"><span class="info-label">Agreement Version:</span><span class="info-value">${data.agreementVersion}</span></div>
    <div class="info-row"><span class="info-label">Signed On:</span><span class="info-value">${data.signedAt}</span></div>
    <div class="info-row"><span class="info-label">IP Address:</span><span class="info-value">${data.ipAddress}</span></div>
    <div class="info-row"><span class="info-label">Tax ID Type:</span><span class="info-value">${data.taxIdType === 'pan' ? 'PAN Card' : 'Aadhaar Card'}</span></div>
  </div>

  <div class="highlight-box">
    <div class="section-title" style="border: none; margin: 0 0 15px 0;">💰 REVENUE SHARING TERMS</div>
    <div class="info-row"><span class="info-label">Platform Lead:</span><span class="info-value">${data.configSnapshot?.coach_cost_percent || 50}% of enrollment fee</span></div>
    <div class="info-row"><span class="info-label">Coach-Sourced Lead:</span><span class="info-value">${(data.configSnapshot?.coach_cost_percent || 50) + (data.configSnapshot?.lead_cost_percent || 20)}% of enrollment fee</span></div>
    <div class="info-row"><span class="info-label">TDS Rate:</span><span class="info-value">${data.configSnapshot?.tds_rate_standard || 10}% (Section 194J)</span></div>
    <div class="info-row"><span class="info-label">TDS Threshold:</span><span class="info-value">₹${(data.configSnapshot?.tds_threshold || 30000).toLocaleString()}/year</span></div>
    <div class="info-row"><span class="info-label">Payout Schedule:</span><span class="info-value">Monthly (7th of each month)</span></div>
  </div>

  <div class="terms-summary">
    <strong>Key Terms Summary:</strong><br/>
    • Independent Contractor relationship (not employment)<br/>
    • ${data.configSnapshot?.cancellation_notice_hours || 24}-hour cancellation notice required<br/>
    • ${data.configSnapshot?.termination_notice_days || 30}-day termination notice period<br/>
    • ${data.configSnapshot?.non_solicitation_months || 12}-month non-solicitation period<br/>
    • Confidentiality and IP protection clauses apply<br/>
    • DPDP Act 2023 compliance required
  </div>

  <div class="signature-section">
    <div class="section-title">DIGITAL SIGNATURE</div>
    <p style="font-size: 13px; color: #555;">This agreement was digitally signed by the Coach. The signature below constitutes acceptance of all terms and conditions.</p>
    <div style="margin: 20px 0;">
      <img src="${data.signatureDataUrl}" class="signature-img" alt="Coach Signature" />
    </div>
    <div class="info-row"><span class="info-label">Signed By:</span><span class="info-value">${data.coachName}</span></div>
    <div class="info-row"><span class="info-label">Date & Time:</span><span class="info-value">${data.signedAt}</span></div>
  </div>

  <div class="footer">
    <p><strong>Yestoryd LLP</strong> | AI-Powered Reading Intelligence for Children</p>
    <p>This is a system-generated document. For queries, contact engage@yestoryd.com</p>
    <p>Document ID: AGR-${Date.now()}</p>
  </div>
</body>
</html>
  `;

  // Convert HTML to base64 (for email attachment, we'll send as HTML)
  // In production, you might use a service like Puppeteer or html-pdf-node
  // For now, we'll attach the HTML as a styled document
  const base64Content = Buffer.from(htmlContent).toString('base64');
  return base64Content;
}

// Send branded email with PDF attachment
async function sendAgreementEmail(data: {
  coachEmail: string;
  coachName: string;
  coachId: string;
  agreementVersion: string;
  signedAt: string;
  ipAddress: string;
  taxIdType: string;
  signatureDataUrl: string;
  configSnapshot: any;
  referralCode?: string;
}): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY not configured');
    return false;
  }

  try {
    // Generate PDF content
    const pdfBase64 = await generateAgreementPDF({
      coachName: data.coachName,
      coachEmail: data.coachEmail,
      agreementVersion: data.agreementVersion,
      signedAt: data.signedAt,
      ipAddress: data.ipAddress,
      taxIdType: data.taxIdType,
      signatureDataUrl: data.signatureDataUrl,
      configSnapshot: data.configSnapshot,
    });

    const referralLink = `https://yestoryd.com/assessment?ref=${data.referralCode || data.coachId}`;
    const dashboardLink = 'https://yestoryd.com/coach/dashboard';
    const whatsappGroup = 'https://chat.whatsapp.com/yestoryd-coaches'; // Update with actual link

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Header with Gradient -->
    <div style="background: linear-gradient(135deg, #7B008B 0%, #FF0099 100%); border-radius: 16px 16px 0 0; padding: 30px; text-align: center;">
      <h1 style="color: white; font-size: 28px; margin: 0;">🎉 Welcome to the Team!</h1>
      <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 8px;">Your Coach Agreement is Now Active</p>
    </div>
    
    <!-- Main Content -->
    <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      
      <p style="font-size: 18px; color: #334155; margin-bottom: 20px;">
        Hi <strong style="color: #7B008B;">${data.coachName}</strong> 👋
      </p>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
        Congratulations! You've officially joined the <strong>Yestoryd coaching family</strong>. We're thrilled to have you on board and can't wait to see the amazing impact you'll make on children's reading journeys! 📚✨
      </p>

      <!-- Agreement Summary Box -->
      <div style="background: linear-gradient(135deg, #fdf4ff, #fce7f3); border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #FF0099;">
        <h3 style="color: #7B008B; font-size: 16px; margin: 0 0 12px 0;">📋 Agreement Summary</h3>
        <table style="width: 100%; font-size: 14px; color: #475569;">
          <tr><td style="padding: 4px 0;"><strong>Version:</strong></td><td>${data.agreementVersion}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Signed On:</strong></td><td>${data.signedAt}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Status:</strong></td><td style="color: #059669;">✅ Active</td></tr>
        </table>
      </div>

      <!-- Earnings Highlight -->
      <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #86efac;">
        <h3 style="color: #166534; font-size: 16px; margin: 0 0 12px 0;">💰 Your Earning Potential</h3>
        <table style="width: 100%; font-size: 14px; color: #166534;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dcfce7;"><strong>Platform Students:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dcfce7; text-align: right;"><strong>₹3,000</strong> per enrollment (50%)</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Your Referrals:</strong></td>
            <td style="padding: 8px 0; text-align: right;"><strong style="color: #FF0099;">₹4,200</strong> per enrollment (70%)</td>
          </tr>
        </table>
        <p style="font-size: 12px; color: #166534; margin: 12px 0 0 0;">
          💡 <em>Bring your own students and earn 20% more!</em>
        </p>
      </div>

      <!-- Referral Link Box -->
      <div style="background: linear-gradient(135deg, #FF0099 0%, #7B008B 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <h3 style="color: white; font-size: 18px; margin: 0 0 8px 0;">🔗 Your Personal Referral Link</h3>
        <p style="color: rgba(255,255,255,0.9); font-size: 13px; margin: 0 0 16px 0;">Share this link to earn 70% on every enrollment!</p>
        <div style="background: white; border-radius: 8px; padding: 12px; word-break: break-all;">
          <a href="${referralLink}" style="color: #7B008B; font-size: 14px; text-decoration: none; font-weight: 600;">${referralLink}</a>
        </div>
        <p style="color: rgba(255,255,255,0.8); font-size: 11px; margin: 12px 0 0 0;">
          Parents who use your link get a FREE reading assessment!
        </p>
      </div>

      <!-- Next Steps -->
      <div style="margin: 24px 0;">
        <h3 style="color: #334155; font-size: 16px; margin: 0 0 16px 0;">🚀 What's Next?</h3>
        
        <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
          <span style="background: #FF0099; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">1</span>
          <div>
            <strong style="color: #334155;">Complete Bank Details</strong>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Add your bank account to receive monthly payouts</p>
          </div>
        </div>
        
        <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
          <span style="background: #7B008B; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">2</span>
          <div>
            <strong style="color: #334155;">Join Coach Community</strong>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Connect with fellow coaches on WhatsApp</p>
          </div>
        </div>
        
        <div style="display: flex; align-items: flex-start;">
          <span style="background: #00ABFF; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">3</span>
          <div>
            <strong style="color: #334155;">Start Referring</strong>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Share your link and start earning!</p>
          </div>
        </div>
      </div>

      <!-- CTA Buttons -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${dashboardLink}" style="display: inline-block; background: linear-gradient(135deg, #FF0099 0%, #7B008B 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 8px;">
          Open Dashboard →
        </a>
      </div>

      <!-- Attachment Note -->
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
        <p style="color: #475569; font-size: 14px; margin: 0;">
          📎 <strong>Your signed agreement is attached to this email.</strong><br/>
          <span style="font-size: 12px; color: #64748b;">Please save it for your records.</span>
        </p>
      </div>
      
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 24px;">
      <p style="color: #64748b; font-size: 13px; margin-bottom: 8px;">
        Questions? Reply to this email or WhatsApp us at +91 8976287997
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        © 2025 Yestoryd LLP | AI-Powered Reading Intelligence for Children
      </p>
      <p style="color: #94a3b8; font-size: 11px; margin-top: 8px;">
        <a href="https://yestoryd.com" style="color: #FF0099; text-decoration: none;">yestoryd.com</a>
      </p>
    </div>
    
  </div>
</body>
</html>
    `;

    const msg = {
      to: data.coachEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'engage@yestoryd.com',
        name: 'Yestoryd',
      },
      replyTo: 'engage@yestoryd.com',
      subject: `🎉 Welcome to Yestoryd! Your Coach Agreement is Active`,
      html: emailHtml,
      attachments: [
        {
          content: pdfBase64,
          filename: `Yestoryd-Coach-Agreement-${data.coachName.replace(/\s+/g, '-')}.html`,
          type: 'text/html',
          disposition: 'attachment',
        },
      ],
    };

    await sgMail.send(msg);
    console.log(`✅ Agreement confirmation email sent to ${data.coachEmail}`);
    return true;

  } catch (error: any) {
    console.error('❌ Email send error:', error.response?.body || error.message);
    return false;
  }
}

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
    const signedAt = new Date().toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'medium'
    });

    // Get coach details first (we need email and name for the email)
    const { data: coachData, error: coachFetchError } = await supabase
      .from('coaches')
      .select('email, name, referral_code')
      .eq('id', coachId)
      .single();

    if (coachFetchError || !coachData) {
      console.error('Error fetching coach:', coachFetchError);
      return NextResponse.json(
        { success: false, error: 'Coach not found' },
        { status: 404 }
      );
    }

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

    // Send branded email with PDF attachment
    const emailSent = await sendAgreementEmail({
      coachEmail: coachData.email,
      coachName: coachData.name || 'Coach',
      coachId,
      agreementVersion,
      signedAt,
      ipAddress,
      taxIdType: taxIdType || 'pan',
      signatureDataUrl,
      configSnapshot,
      referralCode: coachData.referral_code,
    });

    if (!emailSent) {
      console.warn('⚠️ Agreement saved but email failed to send');
    }

    return NextResponse.json({
      success: true,
      message: 'Agreement signed successfully',
      signedAt: new Date().toISOString(),
      signatureUrl: finalSignatureUrl,
      emailSent,
    });

  } catch (error: any) {
    console.error('Error signing agreement:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sign agreement' },
      { status: 500 }
    );
  }
}