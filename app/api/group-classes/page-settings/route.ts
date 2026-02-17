// =============================================================================
// FILE: app/api/group-classes/page-settings/route.ts
// PURPOSE: Fetch dynamic page content from site_settings table
// USAGE: All text, stats, FAQs, CTAs are admin-configurable
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// Default values if database doesn't have the settings
const DEFAULTS = {
  hero_badge: '🎉 Enrolled families get FREE unlimited access!',
  hero_title: 'Fun Group Classes for',
  hero_title_highlight: 'Little Readers',
  hero_subtitle: 'Interactive storytelling, read-aloud competitions, phonics games, and book clubs. Join other kids aged 4-12 in our engaging online sessions!',
  age_range: { min: 4, max: 12 },
  stats: [
    { value: '500+', label: 'Sessions Conducted', icon: 'calendar' },
    { value: '1000+', label: 'Happy Kids', icon: 'users' },
    { value: '4.9★', label: 'Parent Rating', icon: 'star' },
    { value: '50+', label: 'Books Read', icon: 'book' },
  ],
  cta_title: 'Want FREE Unlimited Group Classes?',
  cta_subtitle: 'Enroll in our 1:1 coaching program and get unlimited FREE access to all group classes! Plus personalized reading improvement with expert coaches.',
  cta_primary: { text: 'Take Free Assessment', link: '/assessment' },
  cta_secondary: { text: 'View Coaching Plans', link: '/enroll' },
  benefits: [
    { icon: 'users', title: 'Social Learning', description: 'Children learn better with peers. Group dynamics boost engagement and confidence.' },
    { icon: 'sparkles', title: 'Expert-Led Sessions', description: 'Certified reading coaches lead every session with proven teaching methods.' },
    { icon: 'trophy', title: 'Fun & Interactive', description: 'Games, competitions, and rewards keep kids excited about reading.' },
    { icon: 'shield', title: 'Safe Environment', description: 'Small groups (3-10 kids) ensure every child gets attention and feels comfortable.' },
  ],
  faqs: [
    { question: 'What age groups are these classes for?', answer: 'Our group classes are designed for children aged 4-12 years. Each class type has specific age recommendations to ensure the best learning experience.' },
    { question: 'How do online group classes work?', answer: 'Classes are conducted via Google Meet. After registration, you\'ll receive a meeting link via email and WhatsApp. Simply join at the scheduled time with your child!' },
    { question: 'Are these classes FREE for enrolled families?', answer: 'Yes! When you enroll in our 1:1 coaching program, you get unlimited FREE access to all group classes.' },
    { question: 'How many children are in each class?', answer: 'We keep our classes small (3-10 children) to ensure every child gets attention and participation opportunities.' },
  ],
  trust_badges: [
    { text: 'Certified Coaches', icon: 'badge' },
    { text: '100+ Families', icon: 'users' },
    { text: 'Money-Back Guarantee', icon: 'shield' },
  ],
  meta: {
    title: 'Group Classes for Kids | Yestoryd',
    description: 'Join fun, interactive group reading classes for children aged 4-12.',
    keywords: 'kids reading classes, phonics classes india',
  },
};

export async function GET() {
  try {
    // Fetch all group_classes settings in one query
    const { data: settingsData, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .eq('category', 'group_classes');

    if (error) {
      console.error('Error fetching page settings:', error);
      return NextResponse.json({ settings: DEFAULTS });
    }

    // Convert array to object
    const settingsMap: Record<string, any> = {};
    settingsData?.forEach(item => {
      const key = item.key.replace('group_classes_', '');
      try {
        settingsMap[key] = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
      } catch {
        settingsMap[key] = item.value;
      }
    });

    // Merge with defaults (database values override defaults)
    const settings = {
      hero_badge: settingsMap.hero_badge || DEFAULTS.hero_badge,
      hero_title: settingsMap.hero_title || DEFAULTS.hero_title,
      hero_title_highlight: settingsMap.hero_title_highlight || DEFAULTS.hero_title_highlight,
      hero_subtitle: settingsMap.hero_subtitle || DEFAULTS.hero_subtitle,
      age_range: settingsMap.age_range || DEFAULTS.age_range,
      stats: settingsMap.stats || DEFAULTS.stats,
      cta_title: settingsMap.cta_title || DEFAULTS.cta_title,
      cta_subtitle: settingsMap.cta_subtitle || DEFAULTS.cta_subtitle,
      cta_primary: settingsMap.cta_primary || DEFAULTS.cta_primary,
      cta_secondary: settingsMap.cta_secondary || DEFAULTS.cta_secondary,
      benefits: settingsMap.benefits || DEFAULTS.benefits,
      faqs: settingsMap.faqs || DEFAULTS.faqs,
      trust_badges: settingsMap.trust_badges || DEFAULTS.trust_badges,
      meta: settingsMap.meta || DEFAULTS.meta,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ settings: DEFAULTS });
  }
}
