// ============================================================
// MESSAGES API (Parent-Coach Chat)
// File: app/api/messages/route.ts
// GET - Get messages for a child
// POST - Send a message
// PATCH - Mark messages as read
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api-auth';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Schema for sending a message
const SendMessageSchema = z.object({
  child_id: z.string().uuid(),
  message_text: z.string().min(1).max(2000),
  message_type: z.enum(['text', 'image', 'file']).default('text'),
  attachment_url: z.string().url().optional(),
  attachment_name: z.string().max(200).optional(),
});

// Schema for marking messages as read
const MarkReadSchema = z.object({
  child_id: z.string().uuid(),
  message_ids: z.array(z.string().uuid()).optional(), // If not provided, mark all as read
});

// =====================================================
// GET - Get messages for a child
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('child_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // For pagination

    if (!childId) {
      return NextResponse.json({ error: 'child_id is required' }, { status: 400 });
    }

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(childId)) {
      return NextResponse.json({ error: 'Invalid child_id format' }, { status: 400 });
    }

    // Verify access to this child
    const hasAccess = await verifyChildAccess(auth, childId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this child' }, { status: 403 });
    }

    // Build query
    let query = supabase
      .from('messages')
      .select('*')
      .eq('child_id', childId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get sender names
    const messagesWithSenders = await enrichMessagesWithSenders(messages || []);

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('is_read', false)
      .eq('is_deleted', false)
      .neq('sender_id', auth.userId); // Don't count own messages

    // Get child and coach info
    const { data: child } = await supabase
      .from('children')
      .select(`
        id,
        child_name,
        parent_name,
        assigned_coach_id,
        coaches (
          id,
          name,
          photo_url
        )
      `)
      .eq('id', childId)
      .single();

    return NextResponse.json({
      success: true,
      messages: messagesWithSenders.reverse(), // Return in chronological order
      unread_count: unreadCount || 0,
      child: child ? {
        id: child.id,
        name: child.child_name,
        parent_name: child.parent_name,
        coach: child.coaches,
      } : null,
      has_more: messages?.length === limit,
    });

  } catch (error) {
    console.error('Messages GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// POST - Send a message
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = SendMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const { child_id, message_text, message_type, attachment_url, attachment_name } = validation.data;

    // Verify access to this child
    const hasAccess = await verifyChildAccess(auth, child_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this child' }, { status: 403 });
    }

    // Determine sender type
    let senderType: 'parent' | 'coach' | 'admin' = 'parent';
    if (auth.role === 'coach') senderType = 'coach';
    if (auth.role === 'admin') senderType = 'admin';

    // Create message
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        child_id,
        sender_type: senderType,
        sender_id: auth.userId!,
        message_text,
        message_type,
        attachment_url,
        attachment_name,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating message:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with sender name
    const enrichedMessage = await enrichMessagesWithSenders([message]);

    // TODO: Send notification to the other party
    // This would integrate with AiSensy/SendGrid for real-time notifications
    await sendMessageNotification(child_id, senderType, message_text);

    return NextResponse.json({
      success: true,
      message: enrichedMessage[0],
    }, { status: 201 });

  } catch (error) {
    console.error('Messages POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// PATCH - Mark messages as read
// =====================================================
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = MarkReadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const { child_id, message_ids } = validation.data;

    // Verify access
    const hasAccess = await verifyChildAccess(auth, child_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build update query
    let query = supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('child_id', child_id)
      .eq('is_read', false)
      .neq('sender_id', auth.userId); // Don't mark own messages

    if (message_ids && message_ids.length > 0) {
      query = query.in('id', message_ids);
    }

    const { error, count } = await query;

    if (error) {
      console.error('Error marking messages as read:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      marked_read: count || 0,
    });

  } catch (error) {
    console.error('Messages PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// Helper: Verify access to a child
// =====================================================
async function verifyChildAccess(
  auth: { role?: string; coachId?: string; userId?: string },
  childId: string
): Promise<boolean> {
  // Admin has access to all
  if (auth.role === 'admin') return true;

  // Get child data
  const { data: child } = await supabase
    .from('children')
    .select('assigned_coach_id, parent_id')
    .eq('id', childId)
    .single();

  if (!child) return false;

  // Coach must be assigned to this child
  if (auth.role === 'coach') {
    return child.assigned_coach_id === auth.coachId;
  }

  // Parent must own this child
  if (auth.role === 'parent' || !auth.role) {
    // Get parent ID from user ID
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('user_id', auth.userId)
      .single();

    return parent?.id === child.parent_id;
  }

  return false;
}

// =====================================================
// Helper: Enrich messages with sender names
// =====================================================
async function enrichMessagesWithSenders(messages: any[]): Promise<any[]> {
  if (messages.length === 0) return [];

  // Get unique sender IDs by type
  const coachIds = [...new Set(messages.filter(m => m.sender_type === 'coach').map(m => m.sender_id))];
  const parentIds = [...new Set(messages.filter(m => m.sender_type === 'parent').map(m => m.sender_id))];

  // Fetch coach names
  let coachNames: Record<string, string> = {};
  if (coachIds.length > 0) {
    const { data: coaches } = await supabase
      .from('coaches')
      .select('user_id, name')
      .in('user_id', coachIds);
    
    if (coaches) {
      coachNames = Object.fromEntries(coaches.map(c => [c.user_id, c.name]));
    }
  }

  // Fetch parent names (from children table since parents might not have user accounts)
  let parentNames: Record<string, string> = {};
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('parents')
      .select('user_id, name')
      .in('user_id', parentIds);
    
    if (parents) {
      parentNames = Object.fromEntries(parents.map(p => [p.user_id, p.name]));
    }
  }

  // Enrich messages
  return messages.map(msg => ({
    ...msg,
    sender_name: msg.sender_type === 'coach' 
      ? coachNames[msg.sender_id] || 'Coach'
      : msg.sender_type === 'parent'
        ? parentNames[msg.sender_id] || 'Parent'
        : msg.sender_type === 'admin'
          ? 'Admin'
          : 'System',
  }));
}

// =====================================================
// Helper: Send notification for new message
// =====================================================
async function sendMessageNotification(
  childId: string,
  senderType: string,
  messageText: string
): Promise<void> {
  try {
    // Get child and recipient info
    const { data: child } = await supabase
      .from('children')
      .select(`
        child_name,
        parent_phone,
        assigned_coach_id,
        coaches (
          whatsapp_number
        )
      `)
      .eq('id', childId)
      .single();

    if (!child) return;

    // Determine recipient
    const recipientPhone = senderType === 'coach' 
      ? child.parent_phone  // Notify parent
      : (child.coaches as any)?.whatsapp_number; // Notify coach

    if (!recipientPhone) return;

    // Truncate message for notification
    const truncatedMessage = messageText.length > 100 
      ? messageText.substring(0, 100) + '...' 
      : messageText;

    // Send via communication API (would integrate with existing system)
    // await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/communication/send`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     template: 'new_message_notification',
    //     phone: recipientPhone,
    //     variables: {
    //       child_name: child.child_name,
    //       sender_type: senderType,
    //       message_preview: truncatedMessage,
    //     }
    //   })
    // });

    console.log('Message notification would be sent to:', recipientPhone);
  } catch (error) {
    console.error('Error sending message notification:', error);
    // Don't throw - notification failure shouldn't break message sending
  }
}
