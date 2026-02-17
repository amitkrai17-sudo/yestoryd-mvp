import { Database } from '@/lib/supabase/database.types';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'assessment_passages')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  const passages = JSON.parse(data.value as string);

  console.log('\n=== 10-12 Age Group Passages ===\n');
  const p1012 = passages.filter((p: any) => p.ageGroup === '10-12');
  for (const p of p1012) {
    console.log(`- ${p.title} (${p.level})`);
  }

  const renaissance = passages.find((p: any) => p.title === 'The Renaissance');
  if (renaissance) {
    console.log('\n✅ Renaissance passage FOUND!');
    console.log(`Text: "${renaissance.text.substring(0, 100)}..."`);
  } else {
    console.log('\n❌ Renaissance passage NOT found');
  }
}

verify();
