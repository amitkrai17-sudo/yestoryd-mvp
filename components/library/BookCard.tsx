// =============================================================================
// FILE: components/library/BookCard.tsx
// PURPOSE: Reusable book card for library grid, parent dashboard, Kahani Times
// =============================================================================

'use client';

import Link from 'next/link';
import { Heart, ExternalLink, BookOpen, Users } from 'lucide-react';
import { BookCover } from './BookCover';

interface BookCardProps {
  book: {
    id: string;
    title: string;
    author: string;
    slug: string | null;
    cover_image_url: string | null;
    age_min: number | null;
    age_max: number | null;
    reading_level: string | null;
    skills_targeted: string[] | null;
    genres: string[] | null;
    rucha_review: string | null;
    vote_count: number | null;
    is_available_for_kahani_times: boolean | null;
    affiliate_url: string | null;
    buy_links?: Record<string, string> | null;
  };
  onVote?: (bookId: string) => void;
  /** Whether the current user has already voted for this book */
  hasVoted?: boolean;
}

function getAgeBandLabel(min: number | null, max: number | null): string {
  if (min == null || max == null) return '';
  if (min >= 4 && max <= 6) return '4-6 yrs';
  if (min >= 7 && max <= 9) return '7-9 yrs';
  if (min >= 10 && max <= 12) return '10-12 yrs';
  return `${min}-${max} yrs`;
}

function getBuyUrl(book: BookCardProps['book']): string | null {
  if (book.affiliate_url) return book.affiliate_url;
  if (book.buy_links) {
    return book.buy_links.amazon || book.buy_links.flipkart || book.buy_links.kindle || Object.values(book.buy_links)[0] || null;
  }
  return null;
}

export function BookCard({ book, onVote, hasVoted }: BookCardProps) {
  const buyUrl = getBuyUrl(book);
  const ageLabel = getAgeBandLabel(book.age_min, book.age_max);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <Link href={`/library/${book.slug || book.id}`} className="block p-4">
        <div className="flex gap-4">
          <BookCover coverUrl={book.cover_image_url} title={book.title} size="md" />

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
              {book.title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{book.author}</p>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ageLabel && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded-full">
                  {ageLabel}
                </span>
              )}
              {book.reading_level && (
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-medium rounded-full">
                  {book.reading_level}
                </span>
              )}
              {(book.skills_targeted || []).slice(0, 2).map(skill => (
                <span key={skill} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-full">
                  {skill}
                </span>
              ))}
            </div>

            {/* Rucha's review */}
            {book.rucha_review && (
              <p className="text-xs text-gray-600 mt-2 line-clamp-2 italic">
                <span className="font-medium not-italic text-rose-600">Rucha recommends: </span>
                {book.rucha_review}
              </p>
            )}

            {/* Vote count */}
            {(book.vote_count || 0) > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                <Users className="w-3 h-3" />
                <span>{book.vote_count} families requested</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* CTAs */}
      <div className="flex gap-2 px-4 pb-4">
        {book.is_available_for_kahani_times && (
          <button
            onClick={(e) => { e.preventDefault(); onVote?.(book.id); }}
            className={`flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-medium rounded-xl transition-colors ${
              hasVoted
                ? 'bg-rose-500 text-white border-2 border-rose-500'
                : 'border-2 border-rose-200 text-rose-600 hover:bg-rose-50'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${hasVoted ? 'fill-white' : ''}`} />
            {hasVoted ? 'Requested' : 'Request for Kahani Times'}
          </button>
        )}
        {buyUrl && (
          <a
            href={buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 h-9 px-4 bg-gray-900 text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buy
          </a>
        )}
      </div>
    </div>
  );
}
