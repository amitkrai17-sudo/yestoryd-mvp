// ============================================================
// FILE: app/api/cron/intelligence-practice-recommendations/route.ts
// ============================================================
// Intelligence-Driven Practice Recommendations
// Runs daily to create parent_daily_tasks based on the child's
// intelligence profile growth areas and matching content.
//
// QStash Schedule:
//   cron: "0 3 * * *"  (3:00 AM UTC daily)
//   url: /api/cron/intelligence-practice-recommendations
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { Receiver } from '@upstash/qstash';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ============================================================
// TASK TEMPLATES — maps skill areas to practice tasks
// ============================================================

const SKILL_TASK_MAP: Record<string, {
  title: string;
  description: string;
  task_type: string;
  duration_minutes: number;
}[]> = {
  phonics: [
    { title: 'Sound It Out Practice', description: 'Spend 10 minutes practicing letter sounds with your child. Pick 5 new sounds to learn together.', task_type: 'practice_phonics', duration_minutes: 10 },
    { title: 'Phonics Fun Game', description: 'Play a rhyming game — take turns saying words that rhyme. This builds phonemic awareness!', task_type: 'practice_phonics', duration_minutes: 10 },
  ],
  blending: [
    { title: 'Sound Blending Practice', description: 'Help your child blend 3-letter words: say each sound slowly, then blend them together. Try: cat, dog, sun, map.', task_type: 'practice_phonics', duration_minutes: 10 },
  ],
  fluency: [
    { title: 'Read Aloud Together', description: 'Read a short story aloud together. Take turns reading sentences — this builds reading fluency!', task_type: 'practice_reading', duration_minutes: 15 },
    { title: 'Repeated Reading Practice', description: 'Read the same short passage 3 times. Watch how much smoother it gets each time!', task_type: 'practice_reading', duration_minutes: 10 },
  ],
  comprehension: [
    { title: 'Story Questions Time', description: 'After reading a story, ask "Who?", "What happened?", and "Why?" questions. Discuss the story together.', task_type: 'practice_reading', duration_minutes: 15 },
  ],
  vocabulary: [
    { title: 'New Words Adventure', description: 'Learn 3 new words today! Use each word in a sentence. The more words we know, the better we read.', task_type: 'practice_vocabulary', duration_minutes: 10 },
  ],
  expression: [
    { title: 'Read with Feeling', description: 'Read a story using different voices for different characters. Make it dramatic and fun!', task_type: 'practice_reading', duration_minutes: 10 },
  ],
  sight_words: [
    { title: 'Sight Words Flash', description: 'Practice 10 sight words. Write them on cards, mix them up, and see how fast your child can read them!', task_type: 'practice_reading', duration_minutes: 10 },
  ],
  decoding: [
    { title: 'Word Detective', description: 'Find 5 new words in a book. Sound them out together, letter by letter, then say the whole word.', task_type: 'practice_phonics', duration_minutes: 10 },
  ],
};

// Fallback for skills not in the map
const GENERIC_READING_TASK = {
  title: 'Daily Reading Time',
  description: 'Read together for 15 minutes. Pick a book your child enjoys — the most important thing is making reading fun!',
  task_type: 'practice_reading',
  duration_minutes: 15,
};

// ============================================================
// AUTH VERIFICATION
// ============================================================

async function verifyCronAuth(request: NextRequest, body?: string): Promise<{ isValid: boolean; source: string }> {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isValid: true, source: 'cron_secret' };
  }

  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
      });
      const isValid = await receiver.verify({ signature, body: body || '' });
      if (isValid) return { isValid: true, source: 'qstash' };
    } catch (e) {
      console.error('QStash verification failed:', e);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await verifyCronAuth(request);
    if (!auth.isValid) {
      console.error(JSON.stringify({ requestId, event: 'practice_recs_auth_failed' }));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'practice_recs_started', authSource: auth.source }));

    const supabase = getServiceSupabase();
    const today = new Date().toISOString().split('T')[0];

    // Find children with intelligence profiles
    const { data: profiles, error: profileError } = await supabase
      .from('child_intelligence_profiles')
      .select('child_id, freshness_status, skill_ratings, narrative_profile, overall_reading_level')
      .in('freshness_status', ['fresh', 'aging', 'stale']);

    if (profileError) {
      console.error(JSON.stringify({ requestId, event: 'practice_recs_query_error', error: profileError.message }));
      return NextResponse.json({ error: 'Failed to query profiles' }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, message: 'No profiles found', created: 0 });
    }

    // Also find enrolled children WITHOUT profiles
    const profileChildIds = profiles.map(p => p.child_id);
    const { data: childrenWithoutProfiles } = await supabase
      .from('children')
      .select('id, child_name, name')
      .eq('lead_status', 'enrolled')
      .not('id', 'in', `(${profileChildIds.join(',')})`)
      .limit(50);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Process children with profiles
    for (const profile of profiles) {
      try {
        // Check if tasks already exist for today
        const { count: existingCount } = await supabase
          .from('parent_daily_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('child_id', profile.child_id)
          .eq('task_date', today);

        if (existingCount && existingCount > 0) {
          skipped++;
          continue;
        }

        // Get child info for enrollment
        const { data: child } = await supabase
          .from('children')
          .select('id, child_name, name')
          .eq('id', profile.child_id)
          .single();

        if (!child) { skipped++; continue; }

        const childName = child.child_name || child.name || 'your child';

        // Get active enrollment
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id')
          .eq('child_id', profile.child_id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (profile.freshness_status === 'stale') {
          // Stale profile — create a single nudge task
          await supabase.from('parent_daily_tasks').insert({
            child_id: profile.child_id,
            enrollment_id: enrollment?.id || null,
            task_date: today,
            title: `Update ${childName}'s Reading Profile`,
            description: `${childName}'s reading profile hasn't been updated recently. Schedule a coaching session to get fresh insights about their progress.`,
            linked_skill: 'reading',
            duration_minutes: null,
          });
          created++;
          continue;
        }

        // Fresh/aging — create intelligence-driven practice tasks
        const skillRatings = (profile.skill_ratings || {}) as Record<string, {
          skillName?: string;
          rating?: string;
        }>;

        // Find growth area skills (struggling/developing)
        const growthSkills = Object.values(skillRatings)
          .filter(sr => sr.rating === 'struggling' || sr.rating === 'developing')
          .map(sr => sr.skillName?.toLowerCase().replace(/\s+/g, '_') || '');

        // Match skills to task templates
        const tasksToCreate: {
          title: string;
          description: string;
          linked_skill: string;
          duration_minutes: number | null;
        }[] = [];

        for (const skill of growthSkills) {
          if (tasksToCreate.length >= 2) break;

          // Find matching template
          const matchKey = Object.keys(SKILL_TASK_MAP).find(k => skill.includes(k));
          if (matchKey) {
            const templates = SKILL_TASK_MAP[matchKey];
            // Rotate based on day of year
            const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
            const template = templates[dayOfYear % templates.length];
            tasksToCreate.push({
              title: template.title,
              description: `${template.description} (Recommended because ${childName} is building ${skill.replace(/_/g, ' ')} skills)`,
              linked_skill: matchKey,
              duration_minutes: template.duration_minutes,
            });
          }
        }

        // Ensure at least 1 task, max 3
        if (tasksToCreate.length === 0) {
          tasksToCreate.push({
            title: GENERIC_READING_TASK.title,
            description: GENERIC_READING_TASK.description,
            linked_skill: 'reading',
            duration_minutes: GENERIC_READING_TASK.duration_minutes,
          });
        }

        // Always add a general reading task if we have room
        if (tasksToCreate.length < 3) {
          tasksToCreate.push({
            title: 'Storytime Together',
            description: `Read a book together for 10 minutes. Ask ${childName} to tell you what happened in the story.`,
            linked_skill: 'comprehension',
            duration_minutes: 10,
          });
        }

        // Also try to find matching el_content_items
        if (growthSkills.length > 0) {
          const { data: contentItems } = await supabase
            .from('el_content_items')
            .select('id, title, description, content_type, parent_instruction, difficulty_level')
            .eq('is_active', true)
            .textSearch('search_text', growthSkills.slice(0, 3).join(' | '))
            .limit(1);

          if (contentItems && contentItems.length > 0 && tasksToCreate.length < 3) {
            const item = contentItems[0];
            tasksToCreate.push({
              title: item.title || 'Practice Activity',
              description: item.parent_instruction || item.description || 'Complete this practice activity together.',
              linked_skill: growthSkills[0] || 'reading',
              duration_minutes: 10,
            });
          }
        }

        // Insert tasks (limit to 3)
        const insertTasks = tasksToCreate.slice(0, 3).map(t => ({
          child_id: profile.child_id,
          enrollment_id: enrollment?.id || null,
          task_date: today,
          title: t.title,
          description: t.description,
          linked_skill: t.linked_skill,
          duration_minutes: t.duration_minutes,
        }));

        const { error: insertError } = await supabase
          .from('parent_daily_tasks')
          .insert(insertTasks);

        if (insertError) {
          console.error(JSON.stringify({ requestId, event: 'practice_recs_insert_error', childId: profile.child_id, error: insertError.message }));
          errors++;
        } else {
          created += insertTasks.length;
        }

      } catch (childErr) {
        console.error(JSON.stringify({
          requestId,
          event: 'practice_recs_child_error',
          childId: profile.child_id,
          error: (childErr as Error).message,
        }));
        errors++;
      }
    }

    // Process children WITHOUT profiles
    for (const child of (childrenWithoutProfiles || [])) {
      try {
        const { count: existingCount } = await supabase
          .from('parent_daily_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('child_id', child.id)
          .eq('task_date', today);

        if (existingCount && existingCount > 0) { skipped++; continue; }

        const childName = child.child_name || child.name || 'your child';
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id')
          .eq('child_id', child.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        await supabase.from('parent_daily_tasks').insert({
          child_id: child.id,
          enrollment_id: enrollment?.id || null,
          task_date: today,
          title: 'Daily Reading Time',
          description: `Read together for 15 minutes. Complete a reading assessment to unlock personalized practice for ${childName}.`,
          linked_skill: 'reading',
          duration_minutes: 15,
        });
        created++;
      } catch {
        errors++;
      }
    }

    const latencyMs = Date.now() - startTime;
    const summary = {
      created, skipped, errors,
      profilesProcessed: profiles.length,
      noProfileChildren: childrenWithoutProfiles?.length || 0,
      latencyMs,
    };

    // Activity log
    try {
      await supabase.from('activity_log').insert({
        user_email: 'system@yestoryd.com',
        user_type: 'admin',
        action: 'intelligence_practice_recommendations',
        metadata: { requestId, ...summary },
        created_at: new Date().toISOString(),
      });
    } catch { /* Non-fatal */ }

    console.log(JSON.stringify({ requestId, event: 'practice_recs_complete', ...summary }));

    return NextResponse.json({ success: true, ...summary });

  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    console.error(JSON.stringify({
      requestId,
      event: 'practice_recs_fatal_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs,
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST delegates to GET (QStash sends POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
