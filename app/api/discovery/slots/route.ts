// ============================================================
// FILE: app/api/discovery/slots/route.ts
// ============================================================
// HARDENED VERSION v2 - With Stale-While-Revalidate
// Incorporates feedback: Return stale cache when Google Calendar fails
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import { getDiscoverySlots } from '@/lib/googleCalendar';
import crypto from 'crypto';

// --- CACHE CONFIGURATION ---
interface CacheEntry {
  data: SlotsResponse;
  expiry: number;
  fetchedAt: number;
}

interface SlotsResponse {
  success: boolean;
  slots: Array<{ date: string; time: string; available: boolean }>;
  slotsByDate: Record<string, Array<{ date: string; time: string; available: boolean }>>;
  totalAvailable: number;
  totalSlots: number;
}

let slotsCache: CacheEntry | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STALE_TTL = 30 * 60 * 1000; // 30 minutes (serve stale for this long if API fails)

// --- RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

// --- MAIN HANDLER ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Rate Limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    if (!checkRateLimit(ip)) {
      console.log(JSON.stringify({ requestId, event: 'rate_limited', ip }));
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    // 2. Validate Input
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    let days = 14; // Default

    if (daysParam) {
      const parsed = parseInt(daysParam, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 30) {
        return NextResponse.json(
          { success: false, error: 'Days must be 1-30' },
          { status: 400 }
        );
      }
      days = parsed;
    }

    // 3. Check Fresh Cache (only for default 14 days)
    const now = Date.now();
    if (days === 14 && slotsCache && now < slotsCache.expiry) {
      const cacheAge = Math.round((now - slotsCache.fetchedAt) / 1000);
      console.log(JSON.stringify({ 
        requestId, 
        event: 'cache_hit', 
        cacheAgeSeconds: cacheAge 
      }));
      
      return NextResponse.json({
        ...slotsCache.data,
        cached: true,
        cacheAge: `${cacheAge}s`,
      });
    }

    // 4. Fetch from Google Calendar
    let slots;
    let fetchError: Error | null = null;

    try {
      slots = await getDiscoverySlots(days);
    } catch (error) {
      fetchError = error as Error;
      console.error(JSON.stringify({
        requestId,
        event: 'google_calendar_error',
        error: fetchError.message,
      }));
    }

    // ============================================================
    // STALE-WHILE-REVALIDATE PATTERN
    // If Google Calendar fails, serve stale cache if available
    // ============================================================
    if (fetchError || !slots) {
      // Check if we have stale cache within acceptable window
      if (slotsCache && now < (slotsCache.fetchedAt + STALE_TTL)) {
        const staleAge = Math.round((now - slotsCache.fetchedAt) / 1000);
        
        console.log(JSON.stringify({
          requestId,
          event: 'serving_stale_cache',
          staleAgeSeconds: staleAge,
          reason: fetchError?.message || 'Fetch failed',
        }));

        return NextResponse.json({
          ...slotsCache.data,
          stale: true,
          staleAge: `${staleAge}s`,
          staleReason: 'Google Calendar temporarily unavailable. Showing cached slots.',
          // Reduce available count slightly to account for potential bookings
          totalAvailable: Math.max(0, slotsCache.data.totalAvailable - 2),
        });
      }

      // No cache available - return error
      console.error(JSON.stringify({
        requestId,
        event: 'no_cache_available',
        error: fetchError?.message,
      }));

      return NextResponse.json(
        { 
          success: false, 
          error: 'Unable to fetch available slots. Please try again in a few minutes.',
          retryAfter: 60,
        },
        { status: 503 }
      );
    }

    // 5. Group by date
    const slotsByDate: Record<string, typeof slots> = {};
    for (const slot of slots) {
      if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
      slotsByDate[slot.date].push(slot);
    }

    const response: SlotsResponse = {
      success: true,
      slots,
      slotsByDate,
      totalAvailable: slots.filter(s => s.available).length,
      totalSlots: slots.length,
    };

    // 6. Update Cache (only for default request)
    if (days === 14) {
      slotsCache = {
        data: response,
        expiry: now + CACHE_TTL,
        fetchedAt: now,
      };
      
      console.log(JSON.stringify({
        requestId,
        event: 'cache_updated',
        totalSlots: response.totalSlots,
        totalAvailable: response.totalAvailable,
      }));
    }

    // 7. Log & Return
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'slots_fetched',
      days,
      totalSlots: slots.length,
      totalAvailable: response.totalAvailable,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      ...response,
      cached: false,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error(JSON.stringify({
      requestId,
      event: 'slots_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    // ============================================================
    // STALE-WHILE-REVALIDATE: Last resort fallback
    // ============================================================
    if (slotsCache) {
      const staleAge = Math.round((Date.now() - slotsCache.fetchedAt) / 1000);
      
      console.log(JSON.stringify({
        requestId,
        event: 'returning_stale_on_error',
        staleAgeSeconds: staleAge,
      }));

      return NextResponse.json({
        ...slotsCache.data,
        stale: true,
        staleAge: `${staleAge}s`,
        staleReason: 'Service temporarily unavailable. Showing cached slots.',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get available slots' },
      { status: 500 }
    );
  }
}

// --- HEALTH CHECK ---
export async function HEAD() {
  // Quick health check without fetching slots
  return new NextResponse(null, {
    status: slotsCache ? 200 : 503,
    headers: {
      'X-Cache-Status': slotsCache ? 'available' : 'empty',
      'X-Cache-Age': slotsCache 
        ? `${Math.round((Date.now() - slotsCache.fetchedAt) / 1000)}s` 
        : 'none',
    },
  });
}