// =============================================================================
// FILE: app/classes/page.tsx
// PURPOSE: Server component wrapper with dynamic SEO metadata from site_settings
// =============================================================================

import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import ClassesPageClient from './ClassesPageClient';

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default metadata
const DEFAULT_META = {
  title: 'Group Classes for Kids | Kahani Times, Read Aloud & More | Yestoryd',
  description: 'Join fun, interactive group reading classes for children aged 4-12. Kahani Times storytelling, Read Aloud competitions, Phonics sessions, and Book Clubs. Starting at just ₹199!',
  keywords: 'kids reading classes, children storytelling, phonics classes india, read aloud competition, book club for kids, kahani times, yestoryd group classes',
};

// Fetch metadata from site_settings
async function getMetadata() {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'group_classes_meta')
      .single();
    
    if (data?.value) {
      const meta = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      return { ...DEFAULT_META, ...meta };
    }
    return DEFAULT_META;
  } catch {
    return DEFAULT_META;
  }
}

// Dynamic metadata generation
export async function generateMetadata(): Promise<Metadata> {
  const meta = await getMetadata();
  
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    openGraph: {
      title: meta.title,
      description: meta.description,
      images: ['/images/og-classes.png'],
      type: 'website',
      siteName: 'Yestoryd',
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
    },
  };
}

// Server Component
export default function ClassesPage() {
  return <ClassesPageClient />;
}