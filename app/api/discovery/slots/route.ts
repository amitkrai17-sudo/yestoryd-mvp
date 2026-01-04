import { NextRequest, NextResponse } from 'next/server';
import { getDiscoverySlots } from '@/lib/googleCalendar';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '14');
    
    const slots = await getDiscoverySlots(days);
    
    // Group by date for UI convenience
    const slotsByDate: Record<string, typeof slots> = {};
    for (const slot of slots) {
      if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
      slotsByDate[slot.date].push(slot);
    }
    
    return NextResponse.json({
      success: true,
      slots,
      slotsByDate,
      totalAvailable: slots.filter(s => s.available).length,
      totalSlots: slots.length,
    });
    
  } catch (error) {
    console.error('[API] Discovery slots error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get available slots' },
      { status: 500 }
    );
  }
}
