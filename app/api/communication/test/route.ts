// app/api/communication/test/route.ts
// Test endpoint for communication system

import { NextRequest, NextResponse } from 'next/server';
import { sendCommunication } from '@/lib/communication';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const testType = body.type || 'email'; // 'email', 'whatsapp', 'both'
    const testPhone = body.phone || '918976287997';
    const testEmail = body.email || 'engage@yestoryd.com';

    console.log(`[Test] Running ${testType} test...`);

    // Test with P1_assessment_complete template (has both WhatsApp and Email)
    const result = await sendCommunication({
      templateCode: 'P1_assessment_complete',
      recipientType: 'parent',
      recipientPhone: testPhone,
      recipientEmail: testEmail,
      recipientName: 'Test Parent',
      variables: {
        parent_name: 'Test Parent',
        child_name: 'Test Child',
        score: '7',
        booking_link: 'https://yestoryd.com/book-discovery',
      },
      skipChannels: testType === 'email' 
        ? ['whatsapp', 'sms'] 
        : testType === 'whatsapp' 
          ? ['email', 'sms'] 
          : ['sms'],
    });

    return NextResponse.json({
      success: result.success,
      testType,
      testPhone,
      testEmail,
      results: result.results,
      message: result.success 
        ? `✅ Test ${testType} sent successfully!` 
        : `❌ Test failed. Check results for details.`,
    });

  } catch (error) {
    console.error('[Test] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET endpoint with instructions
export async function GET() {
  return NextResponse.json({
    message: 'Communication Test Endpoint',
    usage: {
      method: 'POST',
      body: {
        type: 'email | whatsapp | both (default: email)',
        phone: 'Phone number with country code (default: 918976287997)',
        email: 'Email address (default: engage@yestoryd.com)',
      },
    },
    examples: [
      {
        description: 'Test email only',
        body: { type: 'email' },
      },
      {
        description: 'Test WhatsApp only',
        body: { type: 'whatsapp', phone: '919876543210' },
      },
      {
        description: 'Test both channels',
        body: { type: 'both', phone: '918976287997', email: 'engage@yestoryd.com' },
      },
    ],
  });
}
