#!/usr/bin/env node
/**
 * Seed Mini Challenge test content
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://agnfzrkrpuwmtjulbbpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbmZ6cmtycHV3bXRqdWxiYnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5NTc3MSwiZXhwIjoyMDgwODcxNzcxfQ.WDSb_AIS36E7-Lsq9Lim6Sk2x_MpUNMrxXWqs7ImPX4'
);

console.log('='.repeat(80));
console.log('SEEDING MINI CHALLENGE CONTENT');
console.log('='.repeat(80));

// First check if required columns exist
console.log('\n1. Checking table structure...\n');

const { data: sample } = await supabase
  .from('elearning_units')
  .select('*')
  .limit(1)
  .single();

const requiredColumns = ['video_url', 'is_mini_challenge', 'goal_area', 'min_age', 'max_age'];
const missingColumns = requiredColumns.filter(col => !(col in sample));

if (missingColumns.length > 0) {
  console.error('❌ Missing required columns:', missingColumns.join(', '));
  console.log('\n⚠️  Please run these migrations first:');
  console.log('   1. migrations/mini-challenge-schema.sql (Step 1)');
  console.log('   2. migrations/add-video-url-column.sql');
  console.log('\nRun in Supabase SQL Editor, then retry this script.');
  process.exit(1);
}

console.log('✅ All required columns exist\n');

// Mini Challenge video content
const videos = [
  {
    name: 'Phonics: Letter Sounds',
    slug: 'mc-phonics-letter-sounds-4-6',
    quest_title: 'Letter Sounds Mini Challenge',
    description: 'Learn basic letter sounds with interactive practice',
    goal_area: 'reading',
    video_url: 'https://www.youtube.com/embed/hq3yfQnllfQ',
    estimated_minutes: 2,
    is_mini_challenge: true,
    min_age: 4,
    max_age: 6,
    difficulty: 'easy',
    status: 'published',
    icon_emoji: '🎵',
  },
  {
    name: 'Phonics: Blending Sounds',
    slug: 'mc-phonics-blending-7-12',
    quest_title: 'Sound Blending Challenge',
    description: 'Practice blending sounds to form words',
    goal_area: 'reading',
    video_url: 'https://www.youtube.com/embed/RE4Y_ekRBcc',
    estimated_minutes: 3,
    is_mini_challenge: true,
    min_age: 7,
    max_age: 12,
    difficulty: 'medium',
    status: 'published',
    icon_emoji: '🔗',
  },
  {
    name: 'Reading Fluency Practice',
    slug: 'mc-fluency-practice',
    quest_title: 'Smooth Reading Challenge',
    description: 'Learn to read smoothly and expressively',
    goal_area: 'reading',
    video_url: 'https://www.youtube.com/embed/LhSCEWHazAU',
    estimated_minutes: 2,
    is_mini_challenge: true,
    min_age: 4,
    max_age: 12,
    difficulty: 'easy',
    status: 'published',
    icon_emoji: '📖',
  },
  {
    name: 'Comprehension: Story Understanding',
    slug: 'mc-comprehension',
    quest_title: 'Story Detective Challenge',
    description: 'Learn to understand what you read',
    goal_area: 'comprehension',
    video_url: 'https://www.youtube.com/embed/Pz8QkgcSq7I',
    estimated_minutes: 2,
    is_mini_challenge: true,
    min_age: 4,
    max_age: 12,
    difficulty: 'medium',
    status: 'published',
    icon_emoji: '🔍',
  },
  {
    name: 'Grammar: Sentence Building',
    slug: 'mc-grammar-basics',
    quest_title: 'Sentence Master Challenge',
    description: 'Learn to build correct sentences',
    goal_area: 'grammar',
    video_url: 'https://www.youtube.com/embed/DA6Ls74LaQI',
    estimated_minutes: 3,
    is_mini_challenge: true,
    min_age: 7,
    max_age: 12,
    difficulty: 'medium',
    status: 'published',
    icon_emoji: '✏️',
  },
  {
    name: 'Speaking: Clear Pronunciation',
    slug: 'mc-speaking-confidence',
    quest_title: 'Clear Speech Challenge',
    description: 'Practice speaking clearly and confidently',
    goal_area: 'speaking',
    video_url: 'https://www.youtube.com/embed/5IXCAPO0Mmo',
    estimated_minutes: 2,
    is_mini_challenge: true,
    min_age: 4,
    max_age: 12,
    difficulty: 'easy',
    status: 'published',
    icon_emoji: '🎤',
  },
  {
    name: 'Creative Writing: Story Starters',
    slug: 'mc-creative-writing',
    quest_title: 'Story Creator Challenge',
    description: 'Learn to write creative stories',
    goal_area: 'creative_writing',
    video_url: 'https://www.youtube.com/embed/kv6M3kPNGbQ',
    estimated_minutes: 2,
    is_mini_challenge: true,
    min_age: 4,
    max_age: 9,
    difficulty: 'medium',
    status: 'published',
    icon_emoji: '🎨',
  },
  {
    name: 'Vocabulary: Word Power',
    slug: 'mc-vocabulary-building',
    quest_title: 'Word Builder Challenge',
    description: 'Expand your vocabulary with fun words',
    goal_area: 'comprehension',
    video_url: 'https://www.youtube.com/embed/DLoRd6_a1CI',
    estimated_minutes: 2,
    is_mini_challenge: true,
    min_age: 4,
    max_age: 12,
    difficulty: 'medium',
    status: 'published',
    icon_emoji: '📚',
  },
];

console.log('2. Inserting mini challenge videos...\n');

let successCount = 0;
let errorCount = 0;

for (const video of videos) {
  try {
    const { data, error } = await supabase
      .from('elearning_units')
      .upsert(video, { onConflict: 'slug' })
      .select('id, name, slug, goal_area');

    if (error) {
      console.error(`❌ ${video.name}: ${error.message}`);
      errorCount++;
    } else {
      console.log(`✅ ${video.name} (${video.goal_area})`);
      successCount++;
    }
  } catch (err) {
    console.error(`❌ ${video.name}: ${err.message}`);
    errorCount++;
  }
}

console.log('\n' + '-'.repeat(80));
console.log(`Success: ${successCount} | Errors: ${errorCount}`);
console.log('-'.repeat(80));

// Verify insertion
console.log('\n3. Verifying mini challenge content...\n');

const { data: miniChallenges, error: verifyError } = await supabase
  .from('elearning_units')
  .select('id, name, goal_area, min_age, max_age, is_mini_challenge, video_url')
  .eq('is_mini_challenge', true)
  .order('goal_area, min_age');

if (verifyError) {
  console.error('❌ Verification failed:', verifyError.message);
} else if (miniChallenges) {
  console.log('📋 Mini Challenge Videos in Database:\n');

  // Group by goal_area
  const grouped = miniChallenges.reduce((acc, mc) => {
    if (!acc[mc.goal_area]) acc[mc.goal_area] = [];
    acc[mc.goal_area].push(mc);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([goalArea, items]) => {
    console.log(`\n📍 ${goalArea.toUpperCase()}`);
    items.forEach(mc => {
      console.log(`  • ${mc.name} (ages ${mc.min_age}-${mc.max_age})`);
      console.log(`    ID: ${mc.id}`);
      console.log(`    Video: ${mc.video_url.substring(0, 50)}...`);
    });
  });

  console.log(`\n✅ Total: ${miniChallenges.length} mini challenge videos`);
}

console.log('\n' + '='.repeat(80));
console.log('SEEDING COMPLETE');
console.log('='.repeat(80));
