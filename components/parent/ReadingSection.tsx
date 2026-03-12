// =============================================================================
// FILE: components/parent/ReadingSection.tsx
// PURPOSE: Parent dashboard — reading progress, log a book, rAI book picks
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen, Plus, Star, ChevronRight,
  Target, Library, Sparkles, Check,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { BookCover } from '@/components/library/BookCover';
import { supabase } from '@/lib/supabase/client';

// ─── Types ───

interface ReadingLog {
  id: string;
  event_date: string;
  data: {
    book_title: string;
    book_author?: string;
    pages_read?: number;
    minutes_read?: number;
    rating?: number;
  };
  ai_summary: string | null;
}

interface ReadingStats {
  booksThisMonth: number;
  monthlyGoal: number;
  totalBooks: number;
}

interface RecommendedBook {
  id: string;
  title: string;
  author: string;
  slug: string | null;
  cover_image_url: string | null;
  reading_level: string | null;
  recommendation_reason: string;
}

interface ReadingSectionProps {
  childId: string;
}

// ─── Component ───

export default function ReadingSection({ childId }: ReadingSectionProps) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [stats, setStats] = useState<ReadingStats>({ booksThisMonth: 0, monthlyGoal: 4, totalBooks: 0 });
  const [recommendations, setRecommendations] = useState<RecommendedBook[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Log form state
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [minutesRead, setMinutesRead] = useState('');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }, []);

  // ── Fetch reading data ──
  const fetchReadingData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/parent/reading?childId=${childId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.readingLogs || []);
        setStats(data.stats);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [childId, getToken]);

  // ── Fetch recommendations ──
  const fetchRecommendations = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/books/recommendations?childId=${childId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setRecommendations(data.recommendations || []);
      }
    } catch {
      // Silent
    } finally {
      setRecsLoading(false);
    }
  }, [childId, getToken]);

  useEffect(() => { fetchReadingData(); }, [fetchReadingData]);
  useEffect(() => { fetchRecommendations(); }, [fetchRecommendations]);

  // ── Submit reading log ──
  const handleLogSubmit = async () => {
    if (!bookTitle.trim()) return;
    setLogSubmitting(true);

    try {
      const token = await getToken();
      const res = await fetch('/api/parent/reading/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          childId,
          bookTitle: bookTitle.trim(),
          bookAuthor: bookAuthor.trim() || undefined,
          minutesRead: minutesRead ? Number(minutesRead) : undefined,
          rating: rating || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setLogSuccess(true);
        setBookTitle('');
        setBookAuthor('');
        setMinutesRead('');
        setRating(0);
        setNotes('');
        setTimeout(() => {
          setShowLogForm(false);
          setLogSuccess(false);
        }, 1500);
        fetchReadingData();
      }
    } catch {
      // Silent
    } finally {
      setLogSubmitting(false);
    }
  };

  const progressPercent = stats.monthlyGoal > 0
    ? Math.min(100, Math.round((stats.booksThisMonth / stats.monthlyGoal) * 100))
    : 0;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex justify-center py-8">
          <Spinner size="md" color="primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Reading Progress Card ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-base">
            <BookOpen className="w-5 h-5 text-[#FF0099]" />
            Reading Progress
          </h2>
          <Link
            href="/library"
            className="text-sm text-[#FF0099] font-medium flex items-center gap-1 hover:underline"
          >
            Browse Library <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="p-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.booksThisMonth}</p>
              <p className="text-xs text-gray-500">This month</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.totalBooks}</p>
              <p className="text-xs text-gray-500">Total books</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#FF0099]">{stats.monthlyGoal}</p>
              <p className="text-xs text-gray-500">Monthly goal</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                Monthly goal progress
              </span>
              <span className="text-xs font-medium text-gray-700">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF0099] to-[#FF66C4] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Recent logs */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Recent reads</p>
              {logs.slice(0, 3).map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                  <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{log.data.book_title}</p>
                    {log.data.book_author && (
                      <p className="text-xs text-gray-500 truncate">{log.data.book_author}</p>
                    )}
                  </div>
                  {log.data.rating && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {Array.from({ length: log.data.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Log a Book Button */}
          <button
            onClick={() => setShowLogForm(!showLogForm)}
            className="mt-4 w-full flex items-center justify-center gap-2 h-10 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-xl border border-gray-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log a Book
          </button>
        </div>

        {/* ─── Log Form ─── */}
        {showLogForm && (
          <div className="border-t border-gray-100 p-5 bg-gray-50/50">
            {logSuccess ? (
              <div className="flex items-center justify-center gap-2 py-4 text-emerald-600">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">Logged successfully</span>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Book title *"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                />
                <input
                  type="text"
                  placeholder="Author (optional)"
                  value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Minutes read"
                    value={minutesRead}
                    onChange={(e) => setMinutesRead(e.target.value)}
                    className="h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099]"
                  />
                  <div className="flex items-center gap-1 justify-center">
                    <span className="text-xs text-gray-500 mr-1">Rating:</span>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setRating(s === rating ? 0 : s)}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-5 h-5 ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF0099]/20 focus:border-[#FF0099] resize-none"
                />
                <button
                  onClick={handleLogSubmit}
                  disabled={!bookTitle.trim() || logSubmitting}
                  className="w-full h-10 bg-[#FF0099] hover:bg-[#E6008A] text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {logSubmitting ? 'Saving...' : 'Save Reading Log'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── rAI Book Picks ─── */}
      {!recsLoading && recommendations.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-base">
              <Sparkles className="w-5 h-5 text-[#FF0099]" />
              Recommended for You
            </h2>
            <Link
              href="/library"
              className="text-sm text-[#FF0099] font-medium flex items-center gap-1 hover:underline"
            >
              See all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="p-5">
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
              {recommendations.slice(0, 4).map((book) => (
                <Link
                  key={book.id}
                  href={book.slug ? `/library/${book.slug}` : '/library'}
                  className="flex-shrink-0 w-[140px] snap-start group"
                >
                  <div className="mb-2">
                    <BookCover
                      coverUrl={book.cover_image_url}
                      title={book.title}
                      size="sm"
                    />
                  </div>
                  <p className="text-xs font-medium text-gray-900 line-clamp-2 group-hover:text-[#FF0099] transition-colors">
                    {book.title}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">{book.author}</p>
                  <p className="text-[10px] text-[#FF0099] mt-0.5 truncate">
                    {book.recommendation_reason}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
