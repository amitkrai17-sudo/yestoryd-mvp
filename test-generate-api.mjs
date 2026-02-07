#!/usr/bin/env node
/**
 * Test Mini Challenge Generate API
 * Prerequisites: Child must exist with assessment completed, goal area set
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://agnfzrkrpuwmtjulbbpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbmZ6cmtycHV3bXRqdWxiYnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5NTc3MSwiZXhwIjoyMDgwODcxNzcxfQ.WDSb_AIS36E7-Lsq9Lim6Sk2x_MpUNMrxXWqs7ImPX4'
);

console.log('🧪 Testing Mini Challenge Generate API\n');

// 1. Find a test child with assessment
console.log('1. Finding test child with assessment...');
const { data: children, error: childError } = await supabase
  .from('children')
  .select('id, name, age, latest_assessment_score, mini_challenge_completed')
  .not('latest_assessment_score', 'is', null)
  .eq('mini_challenge_completed', false)
  .limit(1)
  .single();

if (childError || !children) {
  console.log('❌ No suitable test child found');
  console.log('   Need: Child with assessment_completed_at and mini_challenge_completed=false');
  console.log('\nCreating a test child...');

  // Create test child
  const { data: newChild, error: createError } = await supabase
    .from('children')
    .insert({
      name: 'Test Child Mini Challenge',
      age: 7,
      parent_name: 'Test Parent',
      parent_email: 'test-mini-challenge@example.com',
      latest_assessment_score: 6,
      assessment_completed_at: new Date().toISOString(),
      mini_challenge_completed: false,
      phonics_focus: 'th sounds',
      struggling_phonemes: ['th', 'ch'],
      parent_goals: ['reading', 'comprehension'],
    })
    .select('id, name, age')
    .single();

  if (createError) {
    console.error('❌ Failed to create test child:', createError.message);
    process.exit(1);
  }

  console.log(`✅ Created test child: ${newChild.name} (ID: ${newChild.id})\n`);

  // Test with new child
  await testGenerateAPI(newChild.id, newChild.name);
} else {
  console.log(`✅ Found: ${children.name} (age ${children.age}, score ${children.latest_assessment_score})\n`);
  await testGenerateAPI(children.id, children.name);
}

async function testGenerateAPI(childId, childName) {
  console.log('2. Testing Generate API...');
  console.log(`   Child: ${childName} (${childId})`);
  console.log('   Goal: reading\n');

  try {
    const response = await fetch('http://localhost:3000/api/mini-challenge/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childId,
        goalArea: 'reading',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log(`❌ API Error (${response.status}):`, data.error);
      if (data.details) console.log('   Details:', data.details);
      return;
    }

    console.log('✅ API Response received!\n');
    console.log('📋 Response Summary:');
    console.log(`   Success: ${data.success}`);
    console.log(`   Child: ${data.childName}`);
    console.log(`   Goal Area: ${data.goalArea}`);
    console.log(`   Questions: ${data.questions?.length || 0}`);
    console.log(`   Video: ${data.video?.name || 'N/A'}`);
    console.log(`   Settings: ${JSON.stringify(data.settings || {})}`);

    if (data.questions && data.questions.length > 0) {
      console.log('\n📝 Sample Question:');
      console.log(`   Q: ${data.questions[0].question}`);
      console.log(`   Options: ${data.questions[0].options.join(', ')}`);
      console.log(`   Answer: ${data.questions[0].options[data.questions[0].correct_answer]}`);
    }

    if (data.video) {
      console.log('\n🎬 Video:');
      console.log(`   Name: ${data.video.name}`);
      console.log(`   URL: ${data.video.video_url}`);
      console.log(`   Duration: ${data.video.estimated_minutes} min`);
    }

    console.log('\n✅ Generate API test PASSED!');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}
