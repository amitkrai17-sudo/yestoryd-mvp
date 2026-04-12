// ============================================================
// Per-phone rate limiter for WhatsApp Lead Bot
// In-memory Map-based — resets on deploy (fine for Vercel)
//
// Prevents Gemini quota burn from spam / rapid-fire messages.
// Bounded by MAX_ENTRIES and periodically swept so the Map can't
// grow unbounded across long-lived warm instances.
// ============================================================

interface WindowState {
  count: number;
  windowStart: number;
}

interface PhoneState {
  minute: WindowState;
  hour: WindowState;
}

const MAX_PER_MINUTE = 5;
const MAX_PER_HOUR = 30;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const MAX_ENTRIES = 5000;
const SWEEP_EVERY_N_CALLS = 500;
let callsSinceSweep = 0;

const state = new Map<string, PhoneState>();

export interface RateLimitResult {
  allowed: boolean;
  message?: string;
}

function sweepStaleEntries(now: number): void {
  state.forEach((entry, key) => {
    if (now - entry.hour.windowStart >= ONE_HOUR_MS) {
      state.delete(key);
    }
  });
}

function maybeSweep(now: number): void {
  callsSinceSweep++;
  if (callsSinceSweep >= SWEEP_EVERY_N_CALLS || state.size >= MAX_ENTRIES) {
    sweepStaleEntries(now);
    callsSinceSweep = 0;
  }
}

export function checkRateLimit(phone: string): RateLimitResult {
  const now = Date.now();
  maybeSweep(now);

  let entry = state.get(phone);

  if (!entry) {
    // Hard cap: if sweep didn't free enough slots, drop oldest insertion
    if (state.size >= MAX_ENTRIES) {
      const oldest = state.keys().next().value;
      if (oldest) state.delete(oldest);
    }
    entry = {
      minute: { count: 0, windowStart: now },
      hour: { count: 0, windowStart: now },
    };
    state.set(phone, entry);
  }

  // Reset windows if expired
  if (now - entry.minute.windowStart >= ONE_MINUTE_MS) {
    entry.minute = { count: 0, windowStart: now };
  }
  if (now - entry.hour.windowStart >= ONE_HOUR_MS) {
    entry.hour = { count: 0, windowStart: now };
  }

  // Check limits
  if (entry.minute.count >= MAX_PER_MINUTE) {
    return {
      allowed: false,
      message: `You're sending messages very quickly! Please wait a moment and try again.`,
    };
  }

  if (entry.hour.count >= MAX_PER_HOUR) {
    return {
      allowed: false,
      message: `You've sent a lot of messages recently. Please try again in a little while, or reply "human" to speak with our team directly.`,
    };
  }

  // Allowed — increment both windows
  entry.minute.count++;
  entry.hour.count++;

  return { allowed: true };
}
