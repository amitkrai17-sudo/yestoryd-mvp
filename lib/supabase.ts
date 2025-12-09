import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database
export type Parent = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  created_at: string;
};

export type Coach = {
  id: string;
  email: string;
  name: string;
  slug: string | null;
  bio: string | null;
  avatar_url: string | null;
  specializations: string[] | null;
  hourly_rate: number | null;
  is_active: boolean;
  created_at: string;
};

export type Child = {
  id: string;
  name: string;
  age: number | null;
  grade: string | null;
  parent_id: string | null;
  coach_id: string | null;
  avatar_url: string | null;
  notes: string | null;
  created_at: string;
};

export type EventType = 
  | 'assessment' 
  | 'session' 
  | 'handwritten' 
  | 'quiz' 
  | 'workshop' 
  | 'milestone' 
  | 'note';

export type LearningEvent = {
  id: string;
  child_id: string;
  event_type: EventType;
  event_date: string;
  data: Record<string, any>;
  ai_summary: string | null;
  created_by: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  cal_booking_id: string | null;
  child_id: string | null;
  coach_id: string | null;
  parent_id: string | null;
  event_type: string | null;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  meeting_url: string | null;
  notes: string | null;
  created_at: string;
};

// Helper functions
export async function getChildEvents(childId: string, limit = 50) {
  const { data, error } = await supabase
    .from('learning_events')
    .select('*')
    .eq('child_id', childId)
    .order('event_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as LearningEvent[];
}

export async function addLearningEvent(event: {
  child_id: string;
  event_type: EventType;
  data: Record<string, any>;
  ai_summary?: string;
  created_by?: string;
}) {
  const { data, error } = await supabase
    .from('learning_events')
    .insert(event)
    .select()
    .single();

  if (error) throw error;
  return data as LearningEvent;
}

export async function getChildById(childId: string) {
  const { data, error } = await supabase
    .from('children')
    .select(`
      *,
      parent:parents(*),
      coach:coaches(*)
    `)
    .eq('id', childId)
    .single();

  if (error) throw error;
  return data;
}

export async function getChildrenByParent(parentEmail: string) {
  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .select('id')
    .eq('email', parentEmail)
    .single();

  if (parentError) throw parentError;

  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', parent.id);

  if (error) throw error;
  return data as Child[];
}
