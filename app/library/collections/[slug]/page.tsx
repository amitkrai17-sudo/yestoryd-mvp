// =============================================================================
// FILE: app/library/collections/[slug]/page.tsx
// PURPOSE: Collection detail page — themed book groups curated by Rucha
// =============================================================================

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { BookCard } from '@/components/library/BookCard';
import { ChevronRight, Library } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: collection } = await supabase
    .from('book_collections')
    .select('name, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!collection) {
    return { title: 'Collection Not Found | Yestoryd' };
  }

  const title = `${collection.name} | Book Collection | Yestoryd`;
  const description = collection.description || `Browse books in the ${collection.name} collection, curated by Yestoryd reading experts.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: 'Yestoryd' },
    alternates: { canonical: `https://yestoryd.com/library/collections/${slug}` },
  };
}

export default async function CollectionPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: collection } = await supabase
    .from('book_collections')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!collection) notFound();

  // Fetch books in this collection
  const { data: items } = await supabase
    .from('book_collection_items')
    .select('book_id, books(*)')
    .eq('collection_id', collection.id);

  const books = (items || [])
    .map((i: any) => i.books)
    .filter((b: any) => b && b.is_active);

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2">
        <nav className="flex items-center gap-1 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/library" className="hover:text-gray-600">Library</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700">{collection.name}</span>
        </nav>
      </div>

      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <Library className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-display">{collection.name}</h1>
            <p className="text-sm text-gray-500">{books.length} books</p>
          </div>
        </div>
        {collection.description && (
          <p className="text-gray-600 text-sm mt-2 max-w-xl">{collection.description}</p>
        )}
      </div>

      {/* Book Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        {books.length === 0 ? (
          <div className="text-center py-16">
            <Library className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No books in this collection yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((b: any) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
