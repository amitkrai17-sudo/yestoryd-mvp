// file: app/api/cron/monthly-payouts/route.ts
// Vercel Cron Job - Runs on 7th of every month at 10:00 AM IST
// Processes all due coach payouts automatically

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
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

    console.log('✅ Monthly payout cron completed:', result.summary);

    // Send summary email to admin
    if (result.summary?.total_payouts > 0) {
      try {
        await fetch(`${baseUrl}/api/email/admin-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: `💰 Monthly Payouts Processed - ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`,
            content: `
              <h2>Payout Summary</h2>
              <ul>
                <li>Total Payouts: ${result.summary.total_payouts}</li>
                <li>Coaches Processed: ${result.summary.coaches_processed}</li>
                <li>Successful: ${result.summary.successful}</li>
                <li>Failed: ${result.summary.failed}</li>
                <li>Total Amount: ₹${result.summary.total_amount?.toLocaleString()}</li>
              </ul>
              ${result.errors?.length > 0 ? `
                <h3>⚠️ Errors</h3>
                <ul>
                  ${result.errors.map((e: any) => `<li>${e.coach_name}: ${e.error}</li>`).join('')}
                </ul>
              ` : ''}
            `,
          }),
        });
      } catch (emailError) {
        console.error('Failed to send admin notification:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Monthly payouts processed',
      ...result,
    });

  } catch (error: any) {
    console.error('❌ Monthly payout cron error:', error);
    
    // Try to notify admin of failure
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yestoryd.com';
      await fetch(`${baseUrl}/api/email/admin-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: '🚨 Monthly Payout Cron FAILED',
          content: `<p>Error: ${error.message}</p><p>Time: ${new Date().toISOString()}</p>`,
        }),
      });
    } catch (e) {
      console.error('Failed to send error notification');
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
