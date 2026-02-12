// ============================================================
// FILE: lib/tasks/generate-daily-tasks.ts
// PURPOSE: Rule-based daily parent task generation linked to session templates
// ============================================================

import { createClient } from '@supabase/supabase-js';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// Types
// ============================================================

export interface DailyTask {
  title: string;
  description: string;
  linked_template_code: string;
  linked_skill: string;
  duration_minutes: number;
}

interface TemplateInfo {
  template_code: string;
  title: string;
  age_band: string;
  skill_dimensions: string[];
}

// ============================================================
// Foundation Tasks (age 4-6)
// ============================================================

function getFoundationTasks(
  templateCode: string,
  childName: string,
  dayIndex: number
): DailyTask[] {
  const tasks: DailyTask[][] = [];

  switch (templateCode) {
    case 'F01':
    case 'F02':
      tasks.push([
        {
          title: 'Letter Sound Practice',
          description: `Practice 3 letter sounds with ${childName} for 5 minutes — use the actions from the last session!`,
          linked_template_code: templateCode,
          linked_skill: 'phonics',
          duration_minutes: 5,
        },
        {
          title: 'Sound Treasure Hunt',
          description: `Go on a sound hunt at home! Ask ${childName} to find 3 things that start with the sounds they learned. Make it a game!`,
          linked_template_code: templateCode,
          linked_skill: 'phonics',
          duration_minutes: 10,
        },
        {
          title: 'Sing the Sounds',
          description: `Sing letter sounds together with ${childName}. Point to letters in books or signs and let them tell you the sound.`,
          linked_template_code: templateCode,
          linked_skill: 'phonics',
          duration_minutes: 5,
        },
      ]);
      break;

    case 'F03':
      tasks.push([
        {
          title: 'Rhyme Time Game',
          description: `Play rhyming at dinner! Say a word and ask ${childName} to find a rhyme. Cat... hat... bat! Keep it silly and fun.`,
          linked_template_code: 'F03',
          linked_skill: 'phonemic_awareness',
          duration_minutes: 5,
        },
        {
          title: 'Clap the Syllables',
          description: `Pick 5 objects around the house. Help ${childName} clap the syllables in each word. Wa-ter-me-lon has 4 claps!`,
          linked_template_code: 'F03',
          linked_skill: 'phonemic_awareness',
          duration_minutes: 5,
        },
        {
          title: 'Odd One Out',
          description: `Say 3 words — 2 that rhyme and 1 that doesn't. Can ${childName} spot the odd one out? Cat, hat, dog — which one doesn't rhyme?`,
          linked_template_code: 'F03',
          linked_skill: 'phonemic_awareness',
          duration_minutes: 5,
        },
      ]);
      break;

    case 'F04':
    case 'F05':
      tasks.push([
        {
          title: 'Build CVC Words',
          description: `Build 3 words with letter tiles or cards: sat, pin, top. Let ${childName} read them out loud to you!`,
          linked_template_code: templateCode,
          linked_skill: 'decoding',
          duration_minutes: 10,
        },
        {
          title: 'Word Swap Game',
          description: `Start with "cat" — change one sound to make a new word. Cat → bat → bag. See how many ${childName} can make!`,
          linked_template_code: templateCode,
          linked_skill: 'decoding',
          duration_minutes: 10,
        },
        {
          title: 'Sound It Out',
          description: `Write 4 simple words on paper. Point to each and let ${childName} sound out each letter, then blend them together.`,
          linked_template_code: templateCode,
          linked_skill: 'decoding',
          duration_minutes: 10,
        },
      ]);
      break;

    case 'F06':
    case 'F07':
      tasks.push([
        {
          title: 'Story Time with Questions',
          description: `Read a picture book together. Pause 3 times and ask ${childName}: "What do you think happens next?" Let their imagination run wild!`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 15,
        },
        {
          title: 'Retell the Story',
          description: `After reading, ask ${childName} to tell the story back to you in their own words. What happened first? Then what?`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 10,
        },
        {
          title: 'Picture Walk',
          description: `Before reading a new book, flip through the pictures with ${childName}. What do they think the story is about? Then read and check!`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 10,
        },
      ]);
      break;

    case 'F09':
    case 'F10':
      tasks.push([
        {
          title: 'Sight Word Flash Cards',
          description: `Flash the 6 sight word cards from the session. Aim for instant recognition — no sounding out needed! Celebrate each one ${childName} gets right.`,
          linked_template_code: templateCode,
          linked_skill: 'sight_words',
          duration_minutes: 5,
        },
        {
          title: 'Sight Word Spot',
          description: `While reading together, ask ${childName} to spot sight words on each page. "Can you find 'the' on this page?" High-five for each one!`,
          linked_template_code: templateCode,
          linked_skill: 'sight_words',
          duration_minutes: 10,
        },
        {
          title: 'Write & Read',
          description: `Help ${childName} write 3 sight words with a marker. Then have them read each word back. Writing helps the brain remember!`,
          linked_template_code: templateCode,
          linked_skill: 'sight_words',
          duration_minutes: 10,
        },
      ]);
      break;

    default:
      // Generic foundation tasks
      tasks.push([
        {
          title: 'Read Together',
          description: `Read a picture book with ${childName} for 10 minutes before bed. Let them turn the pages and point to words they know!`,
          linked_template_code: templateCode,
          linked_skill: 'reading',
          duration_minutes: 10,
        },
        {
          title: 'Letter Play',
          description: `Practice writing 5 letters with ${childName}. Make it fun — use different colors, draw them BIG, or trace them in sand!`,
          linked_template_code: templateCode,
          linked_skill: 'phonics',
          duration_minutes: 10,
        },
        {
          title: 'Storytime Chat',
          description: `After reading today, ask ${childName}: "Who was your favorite character? Why?" Little conversations build big understanding!`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 10,
        },
      ]);
  }

  // Return task for the specific day (cycling through variations)
  const taskSet = tasks[0] || [];
  return [taskSet[dayIndex % taskSet.length]];
}

// ============================================================
// Building Tasks (age 7-9)
// ============================================================

function getBuildingTasks(
  templateCode: string,
  childName: string,
  dayIndex: number
): DailyTask[] {
  const tasks: DailyTask[][] = [];

  switch (templateCode) {
    case 'B02':
    case 'B08':
      tasks.push([
        {
          title: 'Decode New Words',
          description: `Write 5 unfamiliar words on paper. Let ${childName} sound them out slowly, then read them faster. No rush — accuracy first!`,
          linked_template_code: templateCode,
          linked_skill: 'decoding',
          duration_minutes: 10,
        },
        {
          title: 'Word Building Challenge',
          description: `Give ${childName} a root word like "play". How many words can they build? Playing, played, player, playground!`,
          linked_template_code: templateCode,
          linked_skill: 'decoding',
          duration_minutes: 10,
        },
        {
          title: 'Read & Spot Patterns',
          description: `While reading, ask ${childName} to find 3 words with the same pattern (like -ight: light, night, sight). Pattern spotting builds reading power!`,
          linked_template_code: templateCode,
          linked_skill: 'decoding',
          duration_minutes: 10,
        },
      ]);
      break;

    case 'B03':
    case 'B09':
      tasks.push([
        {
          title: '1-Minute Reading Sprint',
          description: `Time ${childName} reading for 1 minute. Count the words. Try to beat yesterday's score! Remember: accuracy matters more than speed.`,
          linked_template_code: templateCode,
          linked_skill: 'fluency',
          duration_minutes: 10,
        },
        {
          title: 'Read with Expression',
          description: `Pick a dialogue scene. Help ${childName} read it with expression — give different characters different voices! Make it dramatic and fun.`,
          linked_template_code: templateCode,
          linked_skill: 'fluency',
          duration_minutes: 10,
        },
        {
          title: 'Echo Reading',
          description: `Read a sentence with feeling, then have ${childName} read it back the same way. Take turns being the "leader." Great for building natural reading flow!`,
          linked_template_code: templateCode,
          linked_skill: 'fluency',
          duration_minutes: 10,
        },
      ]);
      break;

    case 'B05':
    case 'B06':
      tasks.push([
        {
          title: 'Think About the Story',
          description: `After today's reading, ask ${childName}: "Why do you think the character did that? What would you have done?" Great thinking practice!`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 10,
        },
        {
          title: 'Story Summary',
          description: `Challenge ${childName} to summarize what they read in just 3 sentences. Beginning, middle, end — like a mini-report!`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 10,
        },
        {
          title: 'Question Time',
          description: `After reading, ${childName} gets to ask YOU 3 questions about the story. Then you ask 3. Who asks the trickiest question wins!`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 10,
        },
      ]);
      break;

    case 'B07':
    case 'B10':
      tasks.push([
        {
          title: 'Fix My Silly Sentence',
          description: `Play "Fix My Silly Sentence" at dinner — say grammatically wrong sentences and let ${childName} correct them. "Me goed to the store" — what's wrong?`,
          linked_template_code: templateCode,
          linked_skill: 'grammar',
          duration_minutes: 10,
        },
        {
          title: 'Write 3 Sentences',
          description: `Ask ${childName} to write 3 sentences about their day. Focus on capital letters and full stops. Quality over quantity!`,
          linked_template_code: templateCode,
          linked_skill: 'writing',
          duration_minutes: 15,
        },
        {
          title: 'Sentence Stretch',
          description: `Start with a short sentence: "The dog ran." Help ${childName} make it longer: "The brown dog ran quickly across the park." Stretching builds writing power!`,
          linked_template_code: templateCode,
          linked_skill: 'grammar',
          duration_minutes: 10,
        },
      ]);
      break;

    case 'B11':
      tasks.push([
        {
          title: 'Sight Word Speed Round',
          description: `Flash sight word cards — aim for 50 words in 2 minutes. Track progress each day. ${childName} will love beating their record!`,
          linked_template_code: 'B11',
          linked_skill: 'sight_words',
          duration_minutes: 10,
        },
        {
          title: 'Sight Word Story',
          description: `Pick 5 sight words. Challenge ${childName} to write a silly story using all 5. The sillier the better!`,
          linked_template_code: 'B11',
          linked_skill: 'sight_words',
          duration_minutes: 15,
        },
        {
          title: 'Word Detective',
          description: `While reading, ${childName} circles (or points to) every sight word they spot. Count them up at the end — how many did they find?`,
          linked_template_code: 'B11',
          linked_skill: 'sight_words',
          duration_minutes: 10,
        },
      ]);
      break;

    default:
      tasks.push([
        {
          title: 'Independent Reading',
          description: `15 minutes of independent reading for ${childName}, then share one interesting thing they read. Building a daily reading habit!`,
          linked_template_code: templateCode,
          linked_skill: 'fluency',
          duration_minutes: 15,
        },
        {
          title: 'Write About It',
          description: `After reading, ${childName} writes 1 sentence about what they read. Just one sentence — but make it a great one!`,
          linked_template_code: templateCode,
          linked_skill: 'writing',
          duration_minutes: 10,
        },
        {
          title: 'Reading Chat',
          description: `Ask ${childName} about what they're reading. Who's their favorite character? What's the most exciting part so far?`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 10,
        },
      ]);
  }

  const taskSet = tasks[0] || [];
  return [taskSet[dayIndex % taskSet.length]];
}

// ============================================================
// Mastery Tasks (age 10-12)
// ============================================================

function getMasteryTasks(
  templateCode: string,
  childName: string,
  dayIndex: number
): DailyTask[] {
  const tasks: DailyTask[][] = [];

  switch (templateCode) {
    case 'M02':
    case 'M07':
      tasks.push([
        {
          title: 'Three Levels of Thinking',
          description: `Ask ${childName} to explain one thing they read today — on the lines (what it said), between the lines (what it means), beyond the lines (what they think about it).`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 10,
        },
        {
          title: 'Opinion Paragraph',
          description: `${childName} writes a paragraph: "I think [character] was wrong/right because..." Supporting an opinion with evidence from the text builds critical thinking!`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 15,
        },
        {
          title: 'Compare & Contrast',
          description: `Ask ${childName} to compare two characters from their book. How are they similar? Different? What motivates each one?`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 10,
        },
      ]);
      break;

    case 'M03':
      tasks.push([
        {
          title: 'Vocabulary Journal',
          description: `${childName} finds 3 new words today. For each: write the word, guess the meaning, look it up, use it in a sentence. Word Power!`,
          linked_template_code: 'M03',
          linked_skill: 'vocabulary',
          duration_minutes: 15,
        },
        {
          title: 'Word of the Day Challenge',
          description: `Pick one new word together. Challenge ${childName} to use it 5 times today in conversation. Bonus points for creative uses!`,
          linked_template_code: 'M03',
          linked_skill: 'vocabulary',
          duration_minutes: 5,
        },
        {
          title: 'Context Clues Detective',
          description: `While reading, when ${childName} hits an unknown word — don't look it up! Use the sentences around it to guess the meaning first.`,
          linked_template_code: 'M03',
          linked_skill: 'vocabulary',
          duration_minutes: 10,
        },
      ]);
      break;

    case 'M04':
      tasks.push([
        {
          title: 'Read Aloud Performance',
          description: `${childName} picks a favorite passage and reads it aloud with feeling. Record it on your phone — they'll love hearing themselves!`,
          linked_template_code: 'M04',
          linked_skill: 'expression',
          duration_minutes: 10,
        },
        {
          title: 'Audiobook Comparison',
          description: `Listen to 2 minutes of an audiobook, then ${childName} reads the same passage. Can they match the narrator's expression and pacing?`,
          linked_template_code: 'M04',
          linked_skill: 'expression',
          duration_minutes: 15,
        },
        {
          title: 'Reader\'s Theatre',
          description: `Pick a dialogue scene. You read one character, ${childName} reads the other. No narrator — just characters talking! Great expression practice.`,
          linked_template_code: 'M04',
          linked_skill: 'expression',
          duration_minutes: 10,
        },
      ]);
      break;

    case 'M05':
    case 'M06':
      tasks.push([
        {
          title: 'Write 5 Sentences',
          description: `${childName} writes 5 sentences about their day. Focus on using interesting vocabulary and varied sentence structures.`,
          linked_template_code: templateCode,
          linked_skill: 'writing',
          duration_minutes: 15,
        },
        {
          title: 'Edit & Improve',
          description: `Take something ${childName} wrote yesterday. Together, make 3 improvements — better word choices, stronger sentences, clearer ideas.`,
          linked_template_code: templateCode,
          linked_skill: 'writing',
          duration_minutes: 15,
        },
        {
          title: 'Mini Essay',
          description: `Pick a topic ${childName} cares about. Write 3 paragraphs: what it is, why it matters, what they think. Real writing for real opinions!`,
          linked_template_code: templateCode,
          linked_skill: 'writing',
          duration_minutes: 20,
        },
      ]);
      break;

    case 'M09':
      tasks.push([
        {
          title: 'Silent Reading Marathon',
          description: `20 minutes of silent reading for ${childName}, then a short journal entry: "Today I read about... and I think..."`,
          linked_template_code: 'M09',
          linked_skill: 'stamina',
          duration_minutes: 25,
        },
        {
          title: 'Reading Timer Challenge',
          description: `Set a timer for 20 minutes. ${childName} reads independently — no breaks! Building stamina is like building a reading muscle.`,
          linked_template_code: 'M09',
          linked_skill: 'stamina',
          duration_minutes: 20,
        },
        {
          title: 'Read & Reflect',
          description: `After 20 minutes of reading, ${childName} writes 3 sentences: a summary, a question they have, and a prediction for what happens next.`,
          linked_template_code: 'M09',
          linked_skill: 'stamina',
          duration_minutes: 25,
        },
      ]);
      break;

    default:
      tasks.push([
        {
          title: 'Independent Reading + Journal',
          description: `20 minutes reading for ${childName}, then 3 new words in the vocabulary journal. Building knowledge one word at a time!`,
          linked_template_code: templateCode,
          linked_skill: 'reading',
          duration_minutes: 25,
        },
        {
          title: 'Book Discussion',
          description: `Talk with ${childName} about their book for 10 minutes. What themes do they notice? What would they change about the story?`,
          linked_template_code: templateCode,
          linked_skill: 'comprehension',
          duration_minutes: 10,
        },
        {
          title: 'Creative Writing',
          description: `${childName} writes a short continuation of the book they're reading. What happens next? Their imagination, their rules!`,
          linked_template_code: templateCode,
          linked_skill: 'writing',
          duration_minutes: 15,
        },
      ]);
  }

  const taskSet = tasks[0] || [];
  return [taskSet[dayIndex % taskSet.length]];
}

// ============================================================
// Main: Generate tasks for days between sessions
// ============================================================

export function generateDailyTasks(
  template: TemplateInfo,
  childName: string,
  dayIndex: number
): DailyTask[] {
  switch (template.age_band) {
    case 'foundation':
      return getFoundationTasks(template.template_code, childName, dayIndex);
    case 'mastery':
      return getMasteryTasks(template.template_code, childName, dayIndex);
    default:
      return getBuildingTasks(template.template_code, childName, dayIndex);
  }
}

// ============================================================
// Trigger: Generate and insert tasks after session completion
// ============================================================

export async function generateAndInsertDailyTasks(
  childId: string,
  sessionId: string
): Promise<{ inserted: number; error?: string }> {
  try {
    const supabase = getSupabase();

    // Get session details
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, enrollment_id, session_template_id, scheduled_date')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return { inserted: 0, error: 'Session not found' };
    }

    // Get child details
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, name, age_band')
      .eq('id', childId)
      .single();

    if (!child) {
      return { inserted: 0, error: 'Child not found' };
    }

    const childName = child.child_name || child.name || 'your child';

    // Get template details
    let template: TemplateInfo | null = null;
    if (session.session_template_id) {
      const { data: t } = await supabase
        .from('session_templates')
        .select('template_code, title, age_band, skill_dimensions')
        .eq('id', session.session_template_id)
        .single();
      if (t) template = t;
    }

    // Fallback template if none assigned
    if (!template) {
      template = {
        template_code: 'DEFAULT',
        title: 'General Practice',
        age_band: child.age_band || 'building',
        skill_dimensions: ['reading'],
      };
    }

    // Find next session date to determine how many days of tasks to generate
    const { data: nextSession } = await supabase
      .from('scheduled_sessions')
      .select('scheduled_date')
      .eq('child_id', childId)
      .gt('scheduled_date', session.scheduled_date)
      .in('status', ['scheduled', 'rescheduled', 'confirmed', 'pending'])
      .order('scheduled_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Generate tasks for days between this session and next (max 7 days)
    const sessionDate = new Date(session.scheduled_date);
    const nextDate = nextSession
      ? new Date(nextSession.scheduled_date)
      : new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const daysBetween = Math.min(
      7,
      Math.ceil((nextDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)) - 1
    );

    if (daysBetween <= 0) {
      return { inserted: 0 };
    }

    const tasksToInsert = [];

    for (let i = 0; i < daysBetween; i++) {
      const taskDate = new Date(sessionDate);
      taskDate.setDate(taskDate.getDate() + i + 1); // Start from day after session
      const dateStr = taskDate.toISOString().split('T')[0];

      const dayTasks = generateDailyTasks(template, childName, i);

      for (const task of dayTasks) {
        tasksToInsert.push({
          child_id: childId,
          enrollment_id: session.enrollment_id,
          task_date: dateStr,
          title: task.title,
          description: task.description,
          linked_template_code: task.linked_template_code,
          linked_skill: task.linked_skill,
          duration_minutes: task.duration_minutes,
          is_completed: false,
        });
      }
    }

    if (tasksToInsert.length > 0) {
      // Use upsert to handle re-generation (same child + date + title = unique constraint)
      const { error: insertError } = await supabase
        .from('parent_daily_tasks')
        .upsert(tasksToInsert, {
          onConflict: 'child_id,task_date,title',
          ignoreDuplicates: true,
        });

      if (insertError) {
        console.error('Daily tasks insert error:', insertError.message);
        return { inserted: 0, error: insertError.message };
      }
    }

    return { inserted: tasksToInsert.length };
  } catch (error: any) {
    console.error('Generate daily tasks error:', error.message);
    return { inserted: 0, error: error.message };
  }
}
