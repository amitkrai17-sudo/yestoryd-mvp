// file: app/api/cron/monthly-payouts/route.ts
// Vercel Cron Job - Runs on 7th of every month at 4:00 AM UTC (9:30 AM IST)
// Processes all due coach payouts automatically

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sets this automatically)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Monthly payout cron started:', new Date().toISOString());

    // Call the payout processing API in LIVE mode
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yestoryd.com';
    
    const response = await fetch(`${baseUrl}/api/payouts/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'live' }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Payout processing failed:', result);
      return NextResponse.json({
        success: false,
        error: 'Payout processing failed',
        details: result,
      }, { status: 500 });
    }

    console.log('✅ Monthly payout cron completed:', result);

    // Send summary email to admin
    try {
      await fetch(`${baseUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'amit@yestoryd.com',
          subject: `Monthly Payouts Processed - ${new Date().toLocaleDateString('en-IN')}`,
          html: `
            <h2>Monthly Payout Summary</h2>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
            <p><strong>Total Processed:</strong> ${result.summary?.total_payouts || 0} payouts</p>
            <p><strong>Total Amount:</strong> ₹${result.summary?.total_amount?.toLocaleString() || 0}</p>
            <p><strong>Successful:</strong> ${result.summary?.successful || 0}</p>
            <p><strong>Failed:</strong> ${result.summary?.failed || 0}</p>
            ${result.summary?.failed > 0 ? '<p style="color: red;">⚠️ Some payouts failed - please check dashboard</p>' : ''}
          `,
        }),
      });
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Monthly payouts processed',
      summary: result.summary,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Monthly payout cron error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Cron job failed',
    }, { status: 500 });
  }
}
