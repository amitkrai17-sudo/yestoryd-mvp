// =============================================================================
// FILE: app/library/LibraryPageClient.tsx
// PURPOSE: Public library browse page — mobile-first, light theme, SEO-friendly
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { BookCard } from '@/components/library/BookCard';
import { BookFilters } from '@/components/library/BookFilters';
import { TrendingBanner } from '@/components/library/TrendingBanner';
import { KahaniVoting } from '@/components/library/KahaniVoting';

// =============================================================================
// TYPES
// =============================================================================

interface Book {
  id: string;
  title: string;
  author: string;
  slug: string | null;
  description: string | null;
  rucha_review: string | null;
  cover_image_url: string | null;
  reading_level: string | null;
  age_min: number | null;
  age_max: number | null;
  genres: string[] | null;
  skills_targeted: string[] | null;
  vote_count: number | null;
  is_available_for_kahani_times: boolean | null;
  affiliate_url: string | null;
  buy_links: Record<string, string> | null;
  is_featured: boolean | null;
}

interface TrendingBook {
  id: string;
  title: string;
  author: string;
  slug: string | null;
  cover_image_url: string | null;
  vote_count: number | null;
  votes_this_month?: number;
}

interface LibraryPageClientProps {
  heroTitle: string;
  heroSubtitle: string;
  booksPerPage: number;
  kahaniVotingEnabled: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function LibraryPageClient({
  heroTitle,
  heroSubtitle,
  booksPerPage,
  kahaniVotingEnabled,
}: LibraryPageClientProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [trending, setTrending] = useState<TrendingBook[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [ageBand, setAgeBand] = useState('');
  const [skill, setSkill] = useState('');
  const [sort, setSort] = useState('popular');

  // ── Fetch books ──
  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(booksPerPage),
      sort,
    });
    if (search) params.set('search', search);
    if (skill) params.set('skill', skill);
    if (ageBand) {
      const [min, max] = ageBand.split('-');
      params.set('age_min', min);
      params.set('age_max', max);
    }

    try {
      const res = await fetch(`/api/books?${params}`);
      const data = await res.json();
      if (data.success) {
        setBooks(data.books);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch {
      // Silent fail — show empty state
    } finally {
      setLoading(false);
    }
  }, [page, search, ageBand, skill, sort, booksPerPage]);

  // ── Fetch trending ──
  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch('/api/books/trending');
      const data = await res.json();
      if (data.success) setTrending(data.books);
    } catch {
      // Silent
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);
  useEffect(() => { fetchTrending(); }, [fetchTrending]);

  // Reset page on filter change
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleAgeBandChange = (v: string) => { setAgeBand(v); setPage(1); };
  const handleSkillChange = (v: string) => { setSkill(v); setPage(1); };

  // Auth state for voting
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [votedBookIds, setVotedBookIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase/client');
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token || null;
        setAuthToken(token);

        // If authenticated, fetch user's voted books for today
        if (token) {
          const res = await fetch('/api/books/kahani-picks', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const result = await res.json();
          if (result.userVotes) {
            setVotedBookIds(new Set(result.userVotes));
          }
        }
      } catch {
        // Not authenticated
      }
    })();
  }, []);

  // ── Vote handler (optimistic) ──
  const handleVote = async (bookId: string) => {
    if (!kahaniVotingEnabled) return;

    if (!authToken) {
      window.location.href = `/assessment?ref=library&book=${bookId}`;
      return;
    }

    const wasVoted = votedBookIds.has(bookId);

    // Optimistic UI
    setVotedBookIds(prev => {
      const next = new Set(prev);
      if (wasVoted) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
    setBooks(prev => prev.map(b =>
      b.id === bookId
        ? { ...b, vote_count: Math.max(0, (b.vote_count || 0) + (wasVoted ? -1 : 1)) }
        : b
    ));

    try {
      if (wasVoted) {
        await fetch(`/api/books/${bookId}/vote?vote_type=kahani_request`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } else {
        const res = await fetch(`/api/books/${bookId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ vote_type: 'kahani_request' }),
        });
        const data = await res.json();
        if (data.already_voted) {
          setVotedBookIds(prev => new Set(prev).add(bookId));
        }
      }
    } catch {
      // Revert on error
      setVotedBookIds(prev => {
        const next = new Set(prev);
        if (wasVoted) next.add(bookId);
        else next.delete(bookId);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ─── HERO ─── */}
      <section className="bg-gradient-to-b from-gray-50 to-white pt-8 pb-6 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-full mb-4">
            <BookOpen className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-medium text-rose-700">Curated by certified reading experts</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 font-display">
            {heroTitle}
          </h1>
          <p className="text-gray-600 mt-3 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            {heroSubtitle}
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 pb-24">
        {/* ─── TRENDING ─── */}
        {!trendingLoading && trending.length > 0 && (
          <div className="mb-6">
            <TrendingBanner books={trending} />
          </div>
        )}

        {/* ─── KAHANI TIMES VOTING ─── */}
        {kahaniVotingEnabled && (
          <div className="mb-6">
            <KahaniVoting compact />
          </div>
        )}

        {/* ─── FILTERS ─── */}
        <div className="mb-6">
          <BookFilters
            search={search}
            onSearchChange={handleSearchChange}
            ageBand={ageBand}
            onAgeBandChange={handleAgeBandChange}
            skill={skill}
            onSkillChange={handleSkillChange}
          />

          {/* Sort + count */}
          <div className="flex items-center justify-between mt-3">
            <p className="text-sm text-gray-500">
              {loading ? 'Loading...' : `${total} books`}
            </p>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none"
            >
              <option value="popular">Most Popular</option>
              <option value="newest">Newest First</option>
              <option value="alphabetical">A-Z</option>
            </select>
          </div>
        </div>

        {/* ─── BOOK GRID ─── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" color="primary" />
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No books match your filters</p>
            <button
              onClick={() => { setSearch(''); setAgeBand(''); setSkill(''); setPage(1); }}
              className="mt-3 text-sm text-rose-600 font-medium hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <BookCard key={book.id} book={book} onVote={handleVote} hasVoted={votedBookIds.has(book.id)} />
            ))}
          </div>
        )}

        {/* ─── PAGINATION ─── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-4 h-10 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-4 h-10 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ─── STICKY BOTTOM CTA ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-100 safe-area-pb">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <Link
            href="/assessment"
            className="flex items-center justify-center gap-2 w-full h-12 bg-[#FF0099] text-white font-semibold text-sm rounded-xl hover:bg-[#E6008A] transition-colors"
          >
            Get personalised book picks
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
