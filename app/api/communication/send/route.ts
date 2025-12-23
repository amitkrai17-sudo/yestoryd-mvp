// app/api/communication/send/route.ts
// API endpoint to send communications

import { NextRequest, NextResponse } from 'next/server';
import { sendCommunication, SendCommunicationParams } from '@/lib/communication';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.templateCode) {
      return NextResponse.json(
        { success: false, error: 'templateCode is required' },
        { status: 400 }
      );
    }

    if (!body.recipientType) {
      return NextResponse.json(
        { success: false, error: 'recipientType is required' },
        { status: 400 }
      );
    }

    if (!body.variables || typeof body.variables !== 'object') {
      return NextResponse.json(
        { success: false, error: 'variables object is required' },
        { status: 400 }
      );
    }

    const params: SendCommunicationParams = {
      templateCode: body.templateCode,
      recipientType: body.recipientType,
      recipientId: body.recipientId,
      recipientPhone: body.recipientPhone,
      recipientEmail: body.recipientEmail,
      recipientName: body.recipientName,
      variables: body.variables,
      relatedEntityType: body.relatedEntityType,
      relatedEntityId: body.relatedEntityId,
      skipChannels: body.skipChannels,
    };

    const result = await sendCommunication(params);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[API] Communication send error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check communication status
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Communication API is running',
    endpoints: {
      send: 'POST /api/communication/send',
    },
  });
}
