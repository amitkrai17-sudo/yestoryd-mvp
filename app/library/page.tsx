// =============================================================================
// FILE: app/library/page.tsx
// PURPOSE: Server component for public book library — SEO metadata + JSON-LD
// =============================================================================

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteSettings } from '@/lib/config/site-settings-loader';
import LibraryPageClient from './LibraryPageClient';

export const dynamic = 'force-dynamic';

const DEFAULT_META = {
  title: 'Reading Library - 1,500+ Expert-Curated Books for Kids | Yestoryd',
  description: 'Browse 1,500+ children\'s books curated by certified reading instructor Rucha Rai. Expert picks matched to your child\'s reading level. Ages 4-12. Phonics, fluency, comprehension.',
  keywords: 'children\'s books India, reading books for kids, phonics books, best books for 4 year olds, best books for 7 year olds, best books for 10 year olds, kids reading list, Yestoryd library',
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings([
    'library_hero_title',
    'library_hero_subtitle',
  ]);

  return {
    title: DEFAULT_META.title,
    description: DEFAULT_META.description,
    keywords: DEFAULT_META.keywords,
    openGraph: {
      title: DEFAULT_META.title,
      description: DEFAULT_META.description,
      type: 'website',
      siteName: 'Yestoryd',
      url: 'https://yestoryd.com/library',
    },
    twitter: {
      card: 'summary_large_image',
      title: DEFAULT_META.title,
      description: DEFAULT_META.description,
    },
    alternates: {
      canonical: 'https://yestoryd.com/library',
    },
  };
}

export default async function LibraryPage() {
  const settings = await getSiteSettings([
    'library_hero_title',
    'library_hero_subtitle',
    'library_books_per_page',
    'library_enabled',
    'kahani_voting_enabled',
  ]);

  // Gate: if library is explicitly disabled, show 404
  const libraryEnabled = settings.library_enabled !== 'false';
  if (!libraryEnabled) notFound();

  const heroTitle = settings.library_hero_title || 'The Reading Corner';
  const heroSubtitle = settings.library_hero_subtitle || '1,500+ books curated by Rucha Rai, certified reading instructor. Expert picks matched to your child\'s reading level.';
  const booksPerPage = parseInt(settings.library_books_per_page || '20');
  const kahaniVotingEnabled = settings.kahani_voting_enabled !== 'false';

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: heroTitle,
            description: heroSubtitle,
            url: 'https://yestoryd.com/library',
            provider: {
              '@type': 'Organization',
              name: 'Yestoryd',
              url: 'https://yestoryd.com',
            },
            about: {
              '@type': 'Thing',
              name: 'Children\'s Reading Books',
              description: 'Expert-curated reading books for children aged 4-12',
            },
          }),
        }}
      />
      <LibraryPageClient
        heroTitle={heroTitle}
        heroSubtitle={heroSubtitle}
        booksPerPage={booksPerPage}
        kahaniVotingEnabled={kahaniVotingEnabled}
      />
    </>
  );
}
