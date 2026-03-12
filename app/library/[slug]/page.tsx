// =============================================================================
// FILE: app/library/[slug]/page.tsx
// PURPOSE: Book detail page — SEO metadata, JSON-LD Book schema, related books
// =============================================================================

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { BookCover } from '@/components/library/BookCover';
import { BookCard } from '@/components/library/BookCard';
import {
  ChevronRight, ExternalLink, Heart, BookOpen,
  User, Building2, Hash, Clock, FileText, Star,
} from 'lucide-react';

// ── Metadata ──

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: book } = await supabase
    .from('books')
    .select('title, author, description, cover_image_url, age_min, age_max, reading_level')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!book) {
    return { title: 'Book Not Found | Yestoryd' };
  }

  const title = `${book.title} by ${book.author} | Yestoryd Library`;
  const description = book.description
    ? `${book.description.slice(0, 150)}...`
    : `${book.title} by ${book.author}. Ages ${book.age_min}-${book.age_max}. ${book.reading_level || ''} level reading book.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: book.cover_image_url ? [book.cover_image_url] : [],
      type: 'website',
      siteName: 'Yestoryd',
      url: `https://yestoryd.com/library/${slug}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: `https://yestoryd.com/library/${slug}`,
    },
  };
}

// ── Page ──

export default async function BookDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!book) notFound();

  // Fetch related books (same age range, max 6)
  const { data: related } = await supabase
    .from('books')
    .select('id, title, author, slug, cover_image_url, reading_level, age_min, age_max, skills_targeted, vote_count, rucha_review, is_available_for_kahani_times, affiliate_url, buy_links, genres')
    .eq('is_active', true)
    .neq('id', book.id)
    .gte('age_min', Math.max((book.age_min || 4) - 2, 0))
    .lte('age_max', (book.age_max || 12) + 2)
    .order('vote_count', { ascending: false, nullsFirst: false })
    .limit(6);

  // Fetch collections this book belongs to
  const { data: collectionItems } = await supabase
    .from('book_collection_items')
    .select('collection_id, book_collections(id, name, slug)')
    .eq('book_id', book.id);

  const collections = (collectionItems || [])
    .map((ci: Record<string, unknown>) => ci.book_collections as { id: string; name: string; slug: string } | null)
    .filter(Boolean);

  const buyLinks = (typeof book.buy_links === 'object' && book.buy_links) ? book.buy_links as Record<string, string> : {};
  const primaryBuyUrl = book.affiliate_url || buyLinks.amazon || buyLinks.flipkart || Object.values(buyLinks)[0] || null;

  return (
    <>
      {/* JSON-LD Book Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: book.title,
            author: { '@type': 'Person', name: book.author },
            ...(book.illustrator && { illustrator: { '@type': 'Person', name: book.illustrator } }),
            ...(book.publisher && { publisher: { '@type': 'Organization', name: book.publisher } }),
            ...(book.isbn && { isbn: book.isbn }),
            ...(book.description && { description: book.description }),
            ...(book.cover_image_url && { image: book.cover_image_url }),
            ...(book.page_count && { numberOfPages: book.page_count }),
            ...(book.average_rating && { aggregateRating: { '@type': 'AggregateRating', ratingValue: book.average_rating, bestRating: 5 } }),
            url: `https://yestoryd.com/library/${slug}`,
          }),
        }}
      />

      <div className="min-h-screen bg-white">
        {/* Breadcrumb */}
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-2">
          <nav className="flex items-center gap-1 text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-600">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/library" className="hover:text-gray-600">Library</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700 truncate max-w-[200px]">{book.title}</span>
          </nav>
        </div>

        {/* Main Content */}
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Cover */}
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <BookCover coverUrl={book.cover_image_url} title={book.title} size="lg" />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 font-display">{book.title}</h1>
              <p className="text-gray-600 mt-1">{book.author}</p>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {book.age_min != null && book.age_max != null && (
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                    Ages {book.age_min}-{book.age_max}
                  </span>
                )}
                {book.reading_level && (
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                    {book.reading_level}
                  </span>
                )}
                {(book.genres as string[] || []).map((g: string) => (
                  <span key={g} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    {g}
                  </span>
                ))}
              </div>

              {/* Skills */}
              {(book.skills_targeted as string[] || []).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Skills targeted</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(book.skills_targeted as string[]).map((s: string) => (
                      <span key={s} className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-gray-500">
                {book.illustrator && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Illustrated by {book.illustrator}</span>
                  </div>
                )}
                {book.publisher && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{book.publisher}</span>
                  </div>
                )}
                {book.isbn && (
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    <span>ISBN: {book.isbn}</span>
                  </div>
                )}
                {book.page_count && (
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{book.page_count} pages</span>
                  </div>
                )}
                {book.reading_time_minutes && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{book.reading_time_minutes} min read</span>
                  </div>
                )}
                {book.average_rating && (
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5" />
                    <span>{book.average_rating}/5 rating</span>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex gap-3 mt-5">
                {book.is_available_for_kahani_times && (
                  <Link
                    href={`/assessment?ref=library&book=${book.id}`}
                    className="flex items-center justify-center gap-2 h-10 px-5 border-2 border-rose-200 text-rose-600 text-sm font-medium rounded-xl hover:bg-rose-50 transition-colors"
                  >
                    <Heart className="w-4 h-4" />
                    Request for Kahani Times
                  </Link>
                )}
                {primaryBuyUrl && (
                  <a
                    href={primaryBuyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 h-10 px-5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Buy This Book
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">About This Book</h2>
              <p className="text-gray-600 text-sm leading-relaxed">{book.description}</p>
            </div>
          )}

          {/* Rucha's Review */}
          {book.rucha_review && (
            <div className="mt-6 bg-rose-50 border border-rose-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-semibold text-rose-800">Rucha Rai&apos;s Expert Review</h3>
              </div>
              <p className="text-sm text-rose-900/80 leading-relaxed italic">
                {book.rucha_review}
              </p>
            </div>
          )}

          {/* Buy Links */}
          {Object.keys(buyLinks).length > 1 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Where to Buy</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(buyLinks).map(([store, url]) => (
                  <a
                    key={store}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 h-9 border border-gray-200 text-gray-700 text-sm rounded-xl hover:bg-gray-50 transition-colors capitalize"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {store}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Collections */}
          {collections.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Featured In</h3>
              <div className="flex flex-wrap gap-2">
                {collections.map((col) => col && (
                  <Link
                    key={col.id}
                    href={`/library/collections/${col.slug}`}
                    className="px-4 py-2 bg-gray-50 border border-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    {col.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related Books */}
          {(related || []).length > 0 && (
            <div className="mt-10 pt-6 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">You Might Also Like</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(related || []).map((b: any) => (
                  <BookCard key={b.id} book={b} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
