// =============================================================================
// FILE: lib/books/book-utils.ts
// PURPOSE: Utility functions for child reading history, stats, and book checks
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

// ─── Types ───

export interface ReadingHistoryEntry {
  event_id: string;
  book_title: string;
  book_author: string | null;
  book_id: string | null;
  event_date: string;
  rating: number | null;
  minutes_read: number | null;
}

export interface ReadingStats {
  booksRead: number;
  totalMinutes: number;
  streakDays: number;
}

// ─── Get Child Reading History ───

export async function getChildReadingHistory(childId: string): Promise<ReadingHistoryEntry[]> {
  const { data } = await supabase
    .from('learning_events')
    .select('id, event_date, event_data')
    .eq('child_id', childId)
    .eq('event_type', 'reading_log')
    .order('event_date', { ascending: false })
    .limit(50);

  if (!data) return [];

  return data.map((e) => {
    const d = e.event_data as Record<string, unknown> | null;
    return {
      event_id: e.id,
      book_title: (d?.book_title as string) || 'Unknown',
      book_author: (d?.book_author as string) || null,
      book_id: (d?.book_id as string) || null,
      event_date: e.event_date as string,
      rating: (d?.rating as number) || null,
      minutes_read: (d?.minutes_read as number) || null,
    };
  });
}

// ─── Get Currently Reading ───

export async function getChildCurrentlyReading(childId: string): Promise<ReadingHistoryEntry | null> {
  // The most recent reading log entry is treated as "currently reading"
  const { data } = await supabase
    .from('learning_events')
    .select('id, event_date, event_data')
    .eq('child_id', childId)
    .eq('event_type', 'reading_log')
    .order('event_date', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;

  const e = data[0];
  const d = e.event_data as Record<string, unknown> | null;
  return {
    event_id: e.id,
    book_title: (d?.book_title as string) || 'Unknown',
    book_author: (d?.book_author as string) || null,
    book_id: (d?.book_id as string) || null,
    event_date: e.event_date as string,
    rating: (d?.rating as number) || null,
    minutes_read: (d?.minutes_read as number) || null,
  };
}

// ─── Get Reading Stats ───

export async function getChildReadingStats(
  childId: string,
  month?: string // YYYY-MM format, defaults to current month
): Promise<ReadingStats> {
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = targetMonth.split('-').map(Number);
  const monthStart = new Date(year, mon - 1, 1).toISOString();
  const monthEnd = new Date(year, mon, 0, 23, 59, 59).toISOString();

  // Count books read this month
  const { data: monthLogs } = await supabase
    .from('learning_events')
    .select('id, event_date, event_data')
    .eq('child_id', childId)
    .eq('event_type', 'reading_log')
    .gte('event_date', monthStart)
    .lte('event_date', monthEnd)
    .order('event_date', { ascending: false });

  const logs = monthLogs || [];
  const booksRead = logs.length;

  // Sum minutes
  let totalMinutes = 0;
  for (const log of logs) {
    const d = log.event_data as Record<string, unknown> | null;
    totalMinutes += (d?.minutes_read as number) || 0;
  }

  // Calculate streak (consecutive days with reading logs going back from today)
  const { data: recentLogs } = await supabase
    .from('learning_events')
    .select('event_date')
    .eq('child_id', childId)
    .eq('event_type', 'reading_log')
    .order('event_date', { ascending: false })
    .limit(60);

  let streakDays = 0;
  if (recentLogs && recentLogs.length > 0) {
    const dates = new Set(
      recentLogs.map((l: { event_date: string | null }) =>
        l.event_date ? l.event_date.split('T')[0] : ''
      ).filter(Boolean)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 60; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      if (dates.has(dateStr)) {
        streakDays++;
      } else if (i > 0) {
        break; // Streak broken
      }
      // Allow today to be missing (streak includes yesterday)
    }
  }

  return { booksRead, totalMinutes, streakDays };
}

// ─── Check If Book Already Read ───

export async function isBookReadByChild(childId: string, bookId: string): Promise<boolean> {
  const { count } = await supabase
    .from('learning_events')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId)
    .eq('event_type', 'reading_log')
    .contains('event_data', { book_id: bookId });

  return (count || 0) > 0;
}

// ─── Get Book Titles Read by Child ───

export async function getChildReadBookTitles(childId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('learning_events')
    .select('event_data')
    .eq('child_id', childId)
    .eq('event_type', 'reading_log');

  const titles = new Set<string>();
  (data || []).forEach((e) => {
    const d = e.event_data as Record<string, unknown> | null;
    const title = d?.book_title as string;
    if (title) titles.add(title.toLowerCase());
  });
  return titles;
}
