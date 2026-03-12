// =============================================================================
// FILE: components/library/TrendingBanner.tsx
// PURPOSE: Horizontal scroll banner showing top requested books
// =============================================================================

'use client';

import Link from 'next/link';
import { TrendingUp, Heart } from 'lucide-react';
import { BookCover } from './BookCover';

interface TrendingBook {
  id: string;
  title: string;
  author: string;
  slug: string | null;
  cover_image_url: string | null;
  vote_count: number | null;
  votes_this_month?: number;
}

interface TrendingBannerProps {
  books: TrendingBook[];
}

export function TrendingBanner({ books }: TrendingBannerProps) {
  if (books.length === 0) return null;

  return (
    <section className="bg-gradient-to-r from-rose-600 to-pink-700 rounded-2xl p-5 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-white" />
        <h2 className="text-white font-semibold text-sm">Most Requested This Month</h2>
      </div>

      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 scrollbar-hide">
        {books.slice(0, 6).map((book) => (
          <Link
            key={book.id}
            href={`/library/${book.slug || book.id}`}
            className="snap-start flex-shrink-0 w-[140px] group"
          >
            <BookCover coverUrl={book.cover_image_url} title={book.title} size="sm" className="mx-auto" />
            <p className="text-white text-xs font-medium mt-2 line-clamp-2 text-center group-hover:underline">
              {book.title}
            </p>
            <p className="text-white/60 text-[10px] text-center mt-0.5">{book.author}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Heart className="w-3 h-3 text-white/70" />
              <span className="text-white/70 text-[10px]">{book.votes_this_month || book.vote_count || 0}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
