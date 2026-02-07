#!/usr/bin/env node
/**
 * Create or find "Mini Challenge" sub_skill for mini challenge videos
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://agnfzrkrpuwmtjulbbpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbmZ6cmtycHV3bXRqdWxiYnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5NTc3MSwiZXhwIjoyMDgwODcxNzcxfQ.WDSb_AIS36E7-Lsq9Lim6Sk2x_MpUNMrxXWqs7ImPX4'
);

console.log('Setting up Mini Challenge sub_skill...\n');

// First, check what a sub_skill looks like
const { data: sampleSubSkill } = await supabase
  .from('sub_skills')
  .select('*')
  .limit(1)
  .single();

if (sampleSubSkill) {
  console.log('Sample sub_skill structure:');
  console.log(Object.keys(sampleSubSkill).join(', '));
  console.log('\nSample values:');
  Object.entries(sampleSubSkill).forEach(([key, value]) => {
    const valueStr = value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value).substring(0, 60) : String(value);
    console.log(`  ${key}: ${valueStr}`);
  });
}

// Check if "Mini Challenge" sub_skill already exists
console.log('\n\nChecking for existing "Mini Challenge" sub_skill...');
const { data: existing } = await supabase
  .from('sub_skills')
  .select('*')
  .eq('name', 'Mini Challenge')
  .single();

if (existing) {
  console.log('✅ Found existing Mini Challenge sub_skill:');
  console.log(`   ID: ${existing.id}`);
  console.log(`   Name: ${existing.name}`);
  console.log('\nUse this ID in seed-mini-challenge-content.mjs');
} else {
  console.log('❌ No "Mini Challenge" sub_skill found.');
  console.log('\nWe need to either:');
  console.log('1. Create a "Mini Challenge" sub_skill');
  console.log('2. OR make sub_skill_id nullable for mini challenges');
  console.log('\nPlease advise on preferred approach.');
}
