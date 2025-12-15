import { createClient } from '@supabase/supabase-js';
import LetsTalkClient from './LetsTalkClient';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getSiteSettings() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value');
  
  if (error || !data) return {};
  
  const settings: { [key: string]: string } = {};
  data.forEach((item: { key: string; value: any }) => {
    // Remove quotes if value is a JSON string
    let val = item.value;
    if (typeof val === 'string') {
      try {
        val = JSON.parse(val);
      } catch {
        // Keep as is
      }
    }
    settings[item.key] = val;
  });
  
  return settings;
}

export const metadata = {
  title: "Let's Talk About Your Child | Yestoryd",
  description: "Schedule a free conversation with Coach Rucha to discuss your child's reading journey. No pressure, no commitment - just a helpful discussion.",
};

export const revalidate = 60; // Revalidate every 60 seconds

export default async function LetsTalkPage() {
  const settings = await getSiteSettings();
  
  return <LetsTalkClient settings={settings} />;
}
