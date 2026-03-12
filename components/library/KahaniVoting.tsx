// =============================================================================
// FILE: components/library/KahaniVoting.tsx
// PURPOSE: Kahani Times voting section — embeddable on /library and /classes
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Heart, BookOpen, ChevronRight, Calendar } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { BookCover } from './BookCover';

// ─── Types ───

interface KahaniBook {
  id: string;
  title: string;
  author: string;
  slug: string | null;
  cover_image_url: string | null;
  vote_count: number | null;
  recent_votes: number;
  vote_progress: number;
  user_voted: boolean;
}

interface KahaniVotingProps {
  /** Optional: next session date to show "This Saturday at..." */
  nextSessionDate?: string;
  /** Optional: next session's featured book */
  thisWeekBook?: { title: string; author: string; cover_image_url: string | null } | null;
  /** Compact mode for embedding in smaller spaces */
  compact?: boolean;
}

// ─── Component ───

export function KahaniVoting({ nextSessionDate, thisWeekBook, compact }: KahaniVotingProps) {
  const [books, setBooks] = useState<KahaniBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingInProgress, setVotingInProgress] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Get auth token if available
  useEffect(() => {
    (async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { supabase } = await import('@/lib/supabase/client');
        const { data } = await supabase.auth.getSession();
        setAuthToken(data.session?.access_token || null);
      } catch {
        // Not authenticated
      }
    })();
  }, []);

  // Fetch kahani picks
  const fetchPicks = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch('/api/books/kahani-picks', { headers });
      const data = await res.json();
      if (data.success) {
        setBooks(data.books || []);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => { fetchPicks(); }, [fetchPicks]);

  // ── Vote handler (optimistic) ──
  const handleVote = async (bookId: string) => {
    if (!authToken) {
      // Redirect to assessment (enrollment flow) if not authenticated
      window.location.href = `/assessment?ref=kahani&book=${bookId}`;
      return;
    }

    if (votingInProgress) return;
    setVotingInProgress(bookId);

    const book = books.find(b => b.id === bookId);
    if (!book) return;

    const wasVoted = book.user_voted;

    // Optimistic update
    setBooks(prev => prev.map(b => {
      if (b.id !== bookId) return b;
      const newVoted = !b.user_voted;
      const newCount = (b.vote_count || 0) + (newVoted ? 1 : -1);
      const newRecent = b.recent_votes + (newVoted ? 1 : -1);
      return { ...b, user_voted: newVoted, vote_count: Math.max(0, newCount), recent_votes: Math.max(0, newRecent) };
    }));

    // Recalculate progress bars
    setBooks(prev => {
      const maxVotes = Math.max(1, ...prev.map(b => b.recent_votes));
      return prev.map(b => ({ ...b, vote_progress: Math.round((b.recent_votes / maxVotes) * 100) }));
    });

    try {
      if (wasVoted) {
        // Unvote
        await fetch(`/api/books/${bookId}/vote?vote_type=kahani_request`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } else {
        // Vote
        const res = await fetch(`/api/books/${bookId}/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ vote_type: 'kahani_request' }),
        });
        const data = await res.json();
        if (data.already_voted) {
          // Revert optimistic update
          setBooks(prev => prev.map(b =>
            b.id === bookId ? { ...b, user_voted: true } : b
          ));
        }
      }
    } catch {
      // Revert on error
      setBooks(prev => prev.map(b => {
        if (b.id !== bookId) return b;
        return { ...b, user_voted: wasVoted, vote_count: (b.vote_count || 0) + (wasVoted ? 1 : -1) };
      }));
    } finally {
      setVotingInProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl p-6">
        <div className="flex justify-center py-4">
          <Spinner size="md" color="primary" />
        </div>
      </div>
    );
  }

  if (books.length === 0) return null;

  const displayBooks = compact ? books.slice(0, 3) : books.slice(0, 5);

  return (
    <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl border border-rose-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-rose-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-base">
              <Heart className="w-5 h-5 text-rose-500" />
              Vote for Next Week&apos;s Story
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              The most-voted book gets read next Saturday
            </p>
          </div>
          {nextSessionDate && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-rose-600 bg-rose-100 px-3 py-1.5 rounded-full">
              <Calendar className="w-3.5 h-3.5" />
              {nextSessionDate}
            </div>
          )}
        </div>
      </div>

      {/* This Week's Story */}
      {thisWeekBook && (
        <div className="px-5 pt-4">
          <div className="flex items-center gap-3 bg-white rounded-xl p-3 border border-rose-100">
            <BookCover coverUrl={thisWeekBook.cover_image_url} title={thisWeekBook.title} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">This Week&apos;s Story</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{thisWeekBook.title}</p>
              <p className="text-xs text-gray-500">by {thisWeekBook.author}</p>
            </div>
          </div>
        </div>
      )}

      {/* Votable Books */}
      <div className="p-5 space-y-2.5">
        {displayBooks.map((book) => (
          <div
            key={book.id}
            className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 hover:border-rose-200 transition-colors"
          >
            {/* Cover */}
            <Link href={book.slug ? `/library/${book.slug}` : `/library`} className="flex-shrink-0">
              <BookCover coverUrl={book.cover_image_url} title={book.title} size="sm" />
            </Link>

            {/* Info + Progress */}
            <div className="flex-1 min-w-0">
              <Link href={book.slug ? `/library/${book.slug}` : `/library`}>
                <p className="text-sm font-medium text-gray-900 truncate hover:text-rose-600 transition-colors">
                  {book.title}
                </p>
                <p className="text-xs text-gray-500 truncate">{book.author}</p>
              </Link>

              {/* Progress bar */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(3, book.vote_progress)}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-medium flex-shrink-0 w-6 text-right">
                  {book.vote_count || 0}
                </span>
              </div>
            </div>

            {/* Vote button */}
            <button
              onClick={() => handleVote(book.id)}
              disabled={votingInProgress === book.id}
              className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
                book.user_voted
                  ? 'bg-rose-500 text-white shadow-sm shadow-rose-200'
                  : 'bg-gray-50 text-gray-400 hover:bg-rose-50 hover:text-rose-500 border border-gray-200'
              }`}
            >
              <Heart className={`w-5 h-5 ${book.user_voted ? 'fill-white' : ''}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between">
        <Link
          href="/library?kahani=true"
          className="text-xs text-rose-600 font-medium hover:underline flex items-center gap-1"
        >
          Suggest a different book <ChevronRight className="w-3.5 h-3.5" />
        </Link>
        {!compact && books.length > 5 && (
          <Link
            href="/library"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            See all books
          </Link>
        )}
      </div>
    </div>
  );
}
