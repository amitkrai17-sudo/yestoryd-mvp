// file: app/api/support/tickets/[id]/route.ts
// Update support ticket status, assignment, and resolution

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, isEmailConfigured } from '@/lib/email/resend-client';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

interface UpdateTicketRequest {
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to?: string;
  resolution_notes?: string;
}

// Send resolution notification to user
async function sendResolutionNotification(ticket: any) {
  if (!isEmailConfigured() || ticket.status !== 'resolved') {
    return;
  }

  const subject = `Your request ${ticket.ticket_number} has been resolved`;
  const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7b008b, #ff0099); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; }
          .resolution-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">Issue Resolved ✓</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">${ticket.ticket_number}</p>
          </div>
          
          <div class="content">
            <p>Hi ${ticket.user_name.split(' ')[0]},</p>
            
            <p>Great news! Your support request has been resolved.</p>
            
            ${ticket.resolution_notes ? `
            <div class="resolution-box">
              <h4 style="margin: 0 0 10px; color: #166534;">Resolution:</h4>
              <p style="margin: 0;">${ticket.resolution_notes}</p>
            </div>
            ` : ''}
            
            <p>If you have any more questions or if the issue persists, please don't hesitate to reach out again.</p>
            
            <p>Thank you for being part of the Yestoryd family!</p>
            
            <p>Warm regards,<br>The Yestoryd Team</p>
          </div>

          <div class="footer">
            <p>© ${new Date().getFullYear()} Yestoryd. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

  try {
    await sendEmail({
      to: ticket.user_email,
      subject,
      html,
      from: { email: 'engage@yestoryd.com', name: 'Yestoryd Support' },
    });
    console.log('✅ Resolution notification sent to:', ticket.user_email);
  } catch (error) {
    console.error('Failed to send resolution notification:', error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = params.id;
    const body: UpdateTicketRequest = await request.json();

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.status) {
      updateData.status = body.status;
      if (body.status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }
    }

    if (body.priority) {
      updateData.priority = body.priority;
    }

    if (body.assigned_to) {
      updateData.assigned_to = body.assigned_to;
    }

    if (body.resolution_notes) {
      updateData.resolution_notes = body.resolution_notes;
    }

    // Update ticket
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update ticket:', error);
      return NextResponse.json(
        { error: 'Failed to update ticket' },
        { status: 500 }
      );
    }

    // Send resolution notification if resolved
    if (body.status === 'resolved') {
      sendResolutionNotification(ticket).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      ticket,
    });

  } catch (error) {
    console.error('Update ticket error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = params.id;

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ticket });

  } catch (error) {
    console.error('Fetch ticket error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket' },
      { status: 500 }
    );
  }
}
