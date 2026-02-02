// file: app/api/support/tickets/route.ts
// Support ticket creation with email notification

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import { loadAuthConfig } from '@/lib/config/loader';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Support categories
const CATEGORIES = {
  session_issue: 'Session Issue',
  payment_billing: 'Payment / Billing',
  technical_problem: 'Technical Problem',
  coach_feedback: 'Coach Feedback',
  schedule_change: 'Schedule Change',
  program_question: 'Program Question',
  other: 'Other',
};

// Priority keywords for auto-detection
const URGENT_KEYWORDS = ['urgent', 'emergency', 'asap', 'immediately', 'critical'];
const HIGH_PRIORITY_KEYWORDS = ['payment', 'refund', 'cancel', 'not working', 'broken'];

interface TicketRequest {
  userType: 'parent' | 'coach';
  userEmail: string;
  userName: string;
  childName?: string;
  coachName?: string;
  category: string;
  subject?: string;
  description: string;
}

// Auto-detect priority based on content
function detectPriority(description: string, category: string): string {
  const lowerDesc = description.toLowerCase();
  
  if (URGENT_KEYWORDS.some(keyword => lowerDesc.includes(keyword))) {
    return 'urgent';
  }
  
  if (HIGH_PRIORITY_KEYWORDS.some(keyword => lowerDesc.includes(keyword)) ||
      category === 'payment_billing') {
    return 'high';
  }
  
  return 'normal';
}

// Send email notification to admin
async function sendAdminNotification(ticket: any) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured, skipping email notification');
    return;
  }

  const priorityEmoji = {
    urgent: '🚨',
    high: '⚠️',
    normal: '📋',
    low: '📝',
  };

  const priorityColor = {
    urgent: '#dc2626',
    high: '#f59e0b',
    normal: '#3b82f6',
    low: '#6b7280',
  };

  const categoryLabel = CATEGORIES[ticket.category as keyof typeof CATEGORIES] || ticket.category;
  const emoji = priorityEmoji[ticket.priority as keyof typeof priorityEmoji] || '📋';
  const color = priorityColor[ticket.priority as keyof typeof priorityColor] || '#3b82f6';

  const msg = {
    to: await loadAuthConfig().then(c => c.adminEmails),
    from: {
      email: 'engage@yestoryd.com',
      name: 'Yestoryd Support',
    },
    subject: `${emoji} New Support Ticket: ${ticket.ticket_number} - ${categoryLabel}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7b008b, #ff0099); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; }
          .ticket-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { display: flex; margin: 10px 0; }
          .info-label { font-weight: 600; width: 120px; color: #666; }
          .info-value { flex: 1; }
          .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
          .description-box { background: #fff; border: 1px solid #e5e5e5; padding: 15px; border-radius: 8px; margin-top: 15px; }
          .cta-button { display: inline-block; background: #7b008b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">New Support Ticket</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">${ticket.ticket_number}</p>
          </div>
          
          <div class="content">
            <div class="ticket-info">
              <div class="info-row">
                <span class="info-label">From:</span>
                <span class="info-value"><strong>${ticket.user_name}</strong> (${ticket.user_type})</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${ticket.user_email}</span>
              </div>
              ${ticket.child_name ? `
              <div class="info-row">
                <span class="info-label">Child:</span>
                <span class="info-value">${ticket.child_name}</span>
              </div>
              ` : ''}
              <div class="info-row">
                <span class="info-label">Category:</span>
                <span class="info-value">${categoryLabel}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Priority:</span>
                <span class="info-value">
                  <span class="priority-badge" style="background: ${color}20; color: ${color};">
                    ${ticket.priority.toUpperCase()}
                  </span>
                </span>
              </div>
            </div>

            ${ticket.subject ? `<h3 style="margin-bottom: 10px;">Subject: ${ticket.subject}</h3>` : ''}
            
            <div class="description-box">
              <h4 style="margin: 0 0 10px; color: #666;">Description:</h4>
              <p style="margin: 0; white-space: pre-wrap;">${ticket.description}</p>
            </div>

            <a href="https://www.yestoryd.com/admin/crm?tab=support" class="cta-button">
              View in Admin CRM →
            </a>
          </div>

          <div class="footer">
            <p>Yestoryd Support System</p>
            <p>This is an automated notification. Please respond to the user directly.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Admin notification sent for ticket:', ticket.ticket_number);
  } catch (error) {
    console.error('Failed to send admin notification:', error);
  }
}

// Send confirmation email to user
async function sendUserConfirmation(ticket: any) {
  if (!process.env.SENDGRID_API_KEY) {
    return;
  }

  const msg = {
    to: ticket.user_email,
    from: {
      email: 'engage@yestoryd.com',
      name: 'Yestoryd Support',
    },
    subject: `We received your request - ${ticket.ticket_number}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7b008b, #ff0099); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; }
          .ticket-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .ticket-number { font-size: 24px; font-weight: bold; color: #7b008b; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">We Got Your Message! 👋</h1>
          </div>
          
          <div class="content">
            <p>Hi ${ticket.user_name.split(' ')[0]},</p>
            
            <p>Thank you for reaching out! We've received your support request and our team will get back to you within <strong>24 hours</strong>.</p>
            
            <div class="ticket-box">
              <p style="margin: 0 0 5px; color: #666;">Your Ticket Number</p>
              <p class="ticket-number">${ticket.ticket_number}</p>
            </div>
            
            <p>If your issue is urgent, you can also reach us on WhatsApp at <strong>+91 8976287997</strong>.</p>
            
            <p>Thank you for being part of the Yestoryd family!</p>
            
            <p>Warm regards,<br>The Yestoryd Team</p>
          </div>

          <div class="footer">
            <p>© ${new Date().getFullYear()} Yestoryd. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log('✅ User confirmation sent to:', ticket.user_email);
  } catch (error) {
    console.error('Failed to send user confirmation:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TicketRequest = await request.json();

    // Validate required fields
    if (!body.userEmail || !body.category || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, category, description' },
        { status: 400 }
      );
    }

    // Auto-detect priority
    const priority = detectPriority(body.description, body.category);

    // Create ticket
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        user_type: body.userType || 'parent',
        user_email: body.userEmail,
        user_name: body.userName || body.userEmail.split('@')[0],
        child_name: body.childName,
        coach_name: body.coachName,
        category: body.category,
        subject: body.subject,
        description: body.description,
        priority,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create ticket:', error);
      return NextResponse.json(
        { error: 'Failed to create support ticket' },
        { status: 500 }
      );
    }

    // Send notifications (async, don't wait)
    Promise.all([
      sendAdminNotification(ticket),
      sendUserConfirmation(ticket),
    ]).catch(console.error);

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        status: ticket.status,
        priority: ticket.priority,
      },
      message: `Support ticket ${ticket.ticket_number} created successfully. We'll respond within 24 hours.`,
    });

  } catch (error) {
    console.error('Support ticket error:', error);
    return NextResponse.json(
      { error: 'Failed to process support request' },
      { status: 500 }
    );
  }
}

// GET: Fetch tickets for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status');
    const isAdmin = searchParams.get('admin') === 'true';

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    // Admin can see all, users see only their own
    if (!isAdmin) {
      query = query.eq('user_email', email);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: tickets, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      tickets: tickets || [],
      count: tickets?.length || 0,
    });

  } catch (error) {
    console.error('Fetch tickets error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}
