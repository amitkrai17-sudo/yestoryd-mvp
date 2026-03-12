#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://agnfzrkrpuwmtjulbbpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbmZ6cmtycHV3bXRqdWxiYnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI5NTc3MSwiZXhwIjoyMDgwODcxNzcxfQ.WDSb_AIS36E7-Lsq9Lim6Sk2x_MpUNMrxXWqs7ImPX4'
);

console.log('Fetching sample elearning_unit to see structure...\n');

const { data, error } = await supabase
  .from('elearning_units')
  .select('*')
  .limit(1)
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('Sample record columns and values:');
  Object.entries(data).forEach(([key, value]) => {
    const valueStr = value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    console.log(`  ${key}: ${valueStr.substring(0, 80)}`);
  });
}
