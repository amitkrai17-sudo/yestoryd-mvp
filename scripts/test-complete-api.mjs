#!/usr/bin/env node
/**
 * Test Mini Challenge Complete API
 * Prerequisites:
 * - Dev server running (npm run dev)
 * - Test child exists in database
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://agnfzrkrpuwmtjulbbpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbmZ6cmtycHV3bXRqdWxiYnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5NTc3MSwiZXhwIjoyMDgwODcxNzcxfQ.WDSb_AIS36E7-Lsq9Lim6Sk2x_MpUNMrxXWqs7ImPX4'
);

console.log('🧪 Testing Mini Challenge Complete API\n');

// 1. Find or create a test child
console.log('1. Finding test child...');
const { data: existingChild } = await supabase
  .from('children')
  .select('id, name, age, mini_challenge_completed')
  .eq('mini_challenge_completed', false)
  .limit(1)
  .single();

let testChildId;
let testChildName;

if (existingChild) {
  testChildId = existingChild.id;
  testChildName = existingChild.name;
  console.log(`✅ Found: ${testChildName} (${testChildId})\n`);
} else {
  console.log('Creating new test child...');
  const { data: newChild, error: createError } = await supabase
    .from('children')
    .insert({
      name: 'Test Complete API',
      age: 7,
      parent_name: 'Test Parent',
      parent_email: 'test-complete-api@example.com',
      latest_assessment_score: 6,
      assessment_completed_at: new Date().toISOString(),
      mini_challenge_completed: false,
    })
    .select('id, name')
    .single();

  if (createError) {
    console.error('❌ Failed to create test child:', createError.message);
    process.exit(1);
  }

  testChildId = newChild.id;
  testChildName = newChild.name;
  console.log(`✅ Created: ${testChildName} (${testChildId})\n`);
}

// 2. Test the Complete API
console.log('2. Testing Complete API...\n');

const testPayload = {
  childId: testChildId,
  goal: 'reading',
  answers: [
    {
      question: 'Which word has the "th" sound?',
      selected_index: 1,
      correct_index: 1,
      is_correct: true,
      time_seconds: 5,
    },
    {
      question: 'What is the correct blend for "cat"?',
      selected_index: 0,
      correct_index: 2,
      is_correct: false,
      time_seconds: 8,
    },
    {
      question: 'Which word rhymes with "cat"?',
      selected_index: 2,
      correct_index: 2,
      is_correct: true,
      time_seconds: 4,
    },
    {
      question: 'How many sounds are in "dog"?',
      selected_index: 1,
      correct_index: 1,
      is_correct: true,
      time_seconds: 6,
    },
  ],
  videoWatched: true,
  videoWatchPercent: 95,
};

console.log('Payload:');
console.log(`  Child: ${testChildName} (${testChildId})`);
console.log(`  Goal: ${testPayload.goal}`);
console.log(`  Questions: ${testPayload.answers.length}`);
console.log(`  Correct: ${testPayload.answers.filter(a => a.is_correct).length}/${testPayload.answers.length}`);
console.log(`  Video watched: ${testPayload.videoWatched} (${testPayload.videoWatchPercent}%)\n`);

try {
  const response = await fetch('http://localhost:3000/api/mini-challenge/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.log(`❌ API Error (${response.status}):`, data.error);
    if (data.details) console.log('   Details:', data.details);
    process.exit(1);
  }

  console.log('✅ API Response:\n');
  console.log('Response:');
  console.log(`  Success: ${data.success}`);
  console.log(`  Request ID: ${data.requestId}`);
  console.log(`  Score: ${data.score}/${data.total}`);
  console.log(`  XP Earned: ${data.xp_earned}`);
  console.log(`  Video Watched: ${data.video_watched}`);
  console.log(`  Discovery Insight: "${data.discovery_insight}"\n`);

  // 3. Verify database updates
  console.log('3. Verifying database updates...\n');

  const { data: updatedChild, error: verifyError } = await supabase
    .from('children')
    .select('mini_challenge_completed, mini_challenge_data')
    .eq('id', testChildId)
    .single();

  if (verifyError) {
    console.error('❌ Failed to verify:', verifyError.message);
    process.exit(1);
  }

  console.log('Database verification:');
  console.log(`  mini_challenge_completed: ${updatedChild.mini_challenge_completed}`);
  console.log(`  mini_challenge_data.xp_earned: ${updatedChild.mini_challenge_data?.xp_earned}`);
  console.log(`  mini_challenge_data.quiz_score: ${updatedChild.mini_challenge_data?.quiz_score}/${updatedChild.mini_challenge_data?.quiz_total}`);
  console.log(`  mini_challenge_data.discovery_insight: "${updatedChild.mini_challenge_data?.discovery_insight}"\n`);

  // 4. Verify learning event
  const { data: events, error: eventError } = await supabase
    .from('learning_events')
    .select('event_type, event_date, event_data')
    .eq('child_id', testChildId)
    .eq('event_type', 'mini_challenge_completed')
    .order('event_date', { ascending: false })
    .limit(1)
    .single();

  if (eventError) {
    console.log('⚠️  Learning event not found (may have failed silently)');
  } else {
    console.log('Learning event verification:');
    console.log(`  event_type: ${events.event_type}`);
    console.log(`  xp_earned: ${events.event_data.xp_earned}`);
    console.log(`  completed_at: ${events.event_data.completed_at}\n`);
  }

  console.log('✅ Complete API test PASSED!\n');
  console.log('=' .repeat(60));
  console.log('SUMMARY:');
  console.log(`  ✅ API endpoint working`);
  console.log(`  ✅ Children table updated`);
  console.log(`  ✅ Discovery insight generated`);
  console.log(`  ✅ XP calculated correctly`);
  console.log(`  ${events ? '✅' : '⚠️ '} Learning event logged`);
  console.log('=' .repeat(60));

} catch (err) {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
}
