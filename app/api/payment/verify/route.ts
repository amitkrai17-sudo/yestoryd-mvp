import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      childId,
      childName,
      parentName,
      parentEmail,
      parentPhone,
      coachId,
      packageType,
      source,
      preferredDay,
      preferredTime,
    } = body;

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Get or create parent
    let parentId: string;
    const { data: existingParent } = await supabase
      .from('parents')
      .select('id')
      .eq('email', parentEmail)
      .single();

    if (existingParent) {
      parentId = existingParent.id;
    } else {
      const { data: newParent, error: parentError } = await supabase
        .from('parents')
        .insert({
          email: parentEmail,
          name: parentName,
          phone: parentPhone,
        })
        .select('id')
        .single();

      if (parentError) throw parentError;
      parentId = newParent.id;
    }

    // Get coach details
    const { data: coach } = await supabase
      .from('coaches')
      .select('id, name, email')
      .eq('id', coachId)
      .single();

    // Create or update child record
    let childRecordId = childId;
    if (!childId || childId === 'new') {
      const { data: newChild, error: childError } = await supabase
        .from('children')
        .insert({
          name: childName,
          parent_id: parentId,
          parent_email: parentEmail,
          parent_phone: parentPhone,
          parent_name: parentName,
          assigned_coach: coachId,
        })
        .select('id')
        .single();

      if (childError) throw childError;
      childRecordId = newChild.id;
    } else {
      await supabase
        .from('children')
        .update({ assigned_coach: coachId })
        .eq('id', childId);
    }

    // Create enrollment record
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .insert({
        child_id: childRecordId,
        parent_id: parentId,
        coach_id: coachId,
        package_type: packageType,
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        amount: packageType === 'coaching-6' ? 5999 : 1999,
        status: 'paid',
        source: source,
        preferred_day: preferredDay,
        preferred_time: preferredTime,
        schedule_confirmed: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (enrollmentError) throw enrollmentError;

    // Record payment
    await supabase.from('payments').insert({
      child_id: childRecordId,
      coach_id: coachId,
      razorpay_order_id: razorpay_order_id,
      razorpay_payment_id: razorpay_payment_id,
      amount: packageType === 'coaching-6' ? 5999 : 1999,
      package_type: packageType,
      source: source,
      status: 'captured',
      captured_at: new Date().toISOString(),
    });

    // Send notification to coach
    await notifyCoach({
      coachEmail: coach?.email || 'rucha@yestoryd.com',
      coachName: coach?.name || 'Coach',
      childName,
      parentName,
      parentEmail,
      parentPhone,
      preferredDay,
      preferredTime,
      enrollmentId: enrollment.id,
    });

    // Send confirmation to parent
    await sendParentConfirmation({
      parentEmail,
      parentName,
      childName,
      coachName: coach?.name || 'Your Coach',
      preferredDay,
      preferredTime,
    });

    return NextResponse.json({
      success: true,
      enrollmentId: enrollment.id,
      message: 'Payment verified, enrollment created',
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(time: string): string {
  const [hours] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:00 ${period}`;
}

async function notifyCoach({
  coachEmail,
  coachName,
  childName,
  parentName,
  parentEmail,
  parentPhone,
  preferredDay,
  preferredTime,
  enrollmentId,
}: {
  coachEmail: string;
  coachName: string;
  childName: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  preferredDay: number;
  preferredTime: string;
  enrollmentId: string;
}) {
  const confirmUrl = `https://yestoryd.com/coach/confirm/${enrollmentId}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #1f2937; font-family: Arial, sans-serif;">
  <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #374151; border-radius: 16px; padding: 30px; border: 1px solid #4b5563;">
      <h1 style="color: #ec4899; margin: 0 0 10px 0; font-size: 24px;">🎉 New Enrollment!</h1>
      <p style="color: #9ca3af; margin: 0 0 20px 0;">Hi ${coachName}, you have a new student!</p>
      
      <div style="background-color: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #9ca3af; padding: 8px 0;">Child</td>
            <td style="color: white; padding: 8px 0; text-align: right; font-weight: bold;">${childName}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 8px 0;">Parent</td>
            <td style="color: white; padding: 8px 0; text-align: right;">${parentName}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 8px 0;">Email</td>
            <td style="color: white; padding: 8px 0; text-align: right;">${parentEmail}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; padding: 8px 0;">Phone</td>
            <td style="color: white; padding: 8px 0; text-align: right;">${parentPhone}</td>
          </tr>
          <tr style="border-top: 1px solid #4b5563;">
            <td style="color: #9ca3af; padding: 12px 0 8px 0;">Preferred Slot</td>
            <td style="color: #ec4899; padding: 12px 0 8px 0; text-align: right; font-weight: bold;">
              ${DAY_NAMES[preferredDay]}s at ${formatTime(preferredTime)}
            </td>
          </tr>
        </table>
      </div>
      
      <p style="color: #9ca3af; font-size: 14px; margin-bottom: 20px;">
        Click below to confirm this slot or choose a different time. This will create all 9 sessions automatically.
      </p>
      
      <a href="${confirmUrl}" style="display: block; background-color: #ec4899; color: white; text-decoration: none; padding: 16px 24px; border-radius: 12px; text-align: center; font-weight: bold; font-size: 16px;">
        Confirm Schedule →
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 20px;">
      Yestoryd Reading Intelligence Platform
    </p>
  </div>
</body>
</html>
  `;

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: coachEmail, name: coachName }] }],
        from: { email: 'engage@yestoryd.com', name: 'Yestoryd' },
        subject: `🎉 New Enrollment: ${childName} - Action Required`,
        content: [{ type: 'text/html', value: htmlContent }],
      }),
    });

    if (!response.ok) {
      console.error('Failed to send coach notification:', await response.text());
    }
  } catch (error) {
    console.error('Coach notification error:', error);
  }
}

async function sendParentConfirmation({
  parentEmail,
  parentName,
  childName,
  coachName,
  preferredDay,
  preferredTime,
}: {
  parentEmail: string;
  parentName: string;
  childName: string;
  coachName: string;
  preferredDay: number;
  preferredTime: string;
}) {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #1f2937; font-family: Arial, sans-serif;">
  <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #374151; border-radius: 16px; padding: 30px; border: 1px solid #4b5563;">
      <h1 style="color: #10b981; margin: 0 0 10px 0; font-size: 24px;">✅ Enrollment Confirmed!</h1>
      <p style="color: white; margin: 0 0 20px 0;">
        Hi ${parentName}, welcome to Yestoryd! 🎉
      </p>
      
      <p style="color: #9ca3af; margin: 0 0 20px 0;">
        ${childName}'s enrollment in the 3-Month Reading Coaching program is confirmed.
      </p>
      
      <div style="background-color: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 14px;">Your Preferred Slot</p>
        <p style="color: #ec4899; margin: 0; font-size: 18px; font-weight: bold;">
          ${DAY_NAMES[preferredDay]}s at ${formatTime(preferredTime)}
        </p>
      </div>
      
      <div style="background-color: #3b82f6; background-color: rgba(59, 130, 246, 0.1); border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(59, 130, 246, 0.3);">
        <p style="color: #60a5fa; margin: 0; font-size: 14px;">
          <strong>What's Next?</strong><br>
          ${coachName} will confirm your schedule within 24 hours. You'll receive calendar invites for all 9 sessions with Google Meet links.
        </p>
      </div>
      
      <p style="color: #9ca3af; font-size: 14px; margin: 0;">
        Questions? Just reply to this email!
      </p>
    </div>
    
    <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 20px;">
      Yestoryd Reading Intelligence Platform
    </p>
  </div>
</body>
</html>
  `;

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: parentEmail, name: parentName }] }],
        from: { email: 'engage@yestoryd.com', name: 'Yestoryd' },
        subject: `✅ ${childName}'s Enrollment Confirmed!`,
        content: [{ type: 'text/html', value: htmlContent }],
      }),
    });

    if (!response.ok) {
      console.error('Failed to send parent confirmation:', await response.text());
    }
  } catch (error) {
    console.error('Parent confirmation error:', error);
  }
}