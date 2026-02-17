/**
 * Update Assessment Passages in Database
 *
 * This script updates the site_settings table with 20 age-appropriate passages
 * following Cambridge English / British Council reading level standards.
 *
 * Run with: npx tsx scripts/update-assessment-passages.ts
 */

import { Database } from '@/lib/supabase/database.types';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl, supabaseServiceKey);

// Cambridge English Level Standards for Yestoryd (ages 4-12)
// - Age 4-5 → "Pre-A1 Starters" (Cambridge YLE)
// - Age 6-7 → "A1 Movers" (Cambridge YLE)
// - Age 8-9 → "A2 Flyers" (Cambridge YLE)
// - Age 10-12 → "B1 Preliminary" (Cambridge PET)

const ASSESSMENT_PASSAGES = [
  // ===================== AGE 4-5: Pre-A1 Starters =====================
  {
    id: "age4-5_1",
    ageGroup: "4-5",
    level: "Pre-A1 Starters",
    title: "The Red Ball",
    text: "I have a red ball. The ball is big and round. I kick the ball. It goes far away. I run fast to get it. My dog runs with me. We play all day. The sun is hot. I am very happy.",
    wordCount: 46,
    readingTime: "1-2 min"
  },
  {
    id: "age4-5_2",
    ageGroup: "4-5",
    level: "Pre-A1 Starters",
    title: "My Cat",
    text: "I see a small cat. The cat has soft white fur. It has big green eyes. The cat sleeps on my bed. It likes warm milk. I love my cat. We play with a red ball. The cat is my best friend.",
    wordCount: 47,
    readingTime: "1-2 min"
  },
  {
    id: "age4-5_3",
    ageGroup: "4-5",
    level: "Pre-A1 Starters",
    title: "At the Park",
    text: "I go to the park with Mum. The park has big trees and green grass. I play on the swing. It goes up and down. I see a bird in the tree. The bird sings a song. I like the park very much.",
    wordCount: 49,
    readingTime: "1-2 min"
  },
  {
    id: "age4-5_4",
    ageGroup: "4-5",
    level: "Pre-A1 Starters",
    title: "The Frog Book",
    text: "Today I went to school. I sat with my friend Tom. We read a book about a frog. The frog was green and small. It could jump very high. After school, I told Mum about the frog. She smiled and gave me a hug.",
    wordCount: 50,
    readingTime: "1-2 min"
  },
  {
    id: "age4-5_5",
    ageGroup: "4-5",
    level: "Pre-A1 Starters",
    title: "My Pet Fish",
    text: "My family has a pet fish. The fish is orange and gold. It swims round and round in its tank. I feed the fish every morning. The fish comes up to eat the food. I like to watch it swim. My fish makes me happy every day.",
    wordCount: 51,
    readingTime: "1-2 min"
  },

  // ===================== AGE 6-7: A1 Movers =====================
  {
    id: "age6-7_1",
    ageGroup: "6-7",
    level: "A1 Movers",
    title: "Beach Day",
    text: "Last summer, we went to the beach. The sand was warm under my feet. I made a big sandcastle with my sister. The waves came and washed it away. We laughed and built another one. Dad bought us ice cream. It was the best day of the summer holidays.",
    wordCount: 55,
    readingTime: "1-2 min"
  },
  {
    id: "age6-7_2",
    ageGroup: "6-7",
    level: "A1 Movers",
    title: "Grandmother's Garden",
    text: "My grandmother lives in a small village. She has a beautiful garden with many flowers. When I visit her, we pick tomatoes and carrots together. She makes the best soup in the world. At night, she tells me stories about when she was young. I love spending time with my grandmother. Her house always smells like fresh bread.",
    wordCount: 64,
    readingTime: "1-2 min"
  },
  {
    id: "age6-7_3",
    ageGroup: "6-7",
    level: "A1 Movers",
    title: "The Library",
    text: "There is a big library near my school. Every week, my class goes there to borrow books. I like books about animals and space. Last week, I found a book about dinosaurs. It had many colourful pictures. The librarian is very kind and helps us find good books. Reading makes me feel like I can go anywhere in the world.",
    wordCount: 65,
    readingTime: "1-2 min"
  },
  {
    id: "age6-7_4",
    ageGroup: "6-7",
    level: "A1 Movers",
    title: "My Best Friend",
    text: "My best friend is called Sam. We met on the first day of school. Sam is funny and kind. We like to play football together at break time. Sometimes we trade snacks from our lunch boxes. When I was sick, Sam made me a card. It said get well soon with a drawing of us playing. I am lucky to have such a good friend.",
    wordCount: 71,
    readingTime: "1-2 min"
  },
  {
    id: "age6-7_5",
    ageGroup: "6-7",
    level: "A1 Movers",
    title: "Saturday Market",
    text: "Every Saturday, my dad and I go to the market. There are many stalls with fruits, vegetables, and flowers. I help Dad choose the best apples and oranges. The man who sells fish always gives me a smile. After shopping, we stop at a cafe for hot chocolate. I like watching all the people walking by. The market is noisy but fun. It is my favourite part of the week.",
    wordCount: 78,
    readingTime: "2-3 min"
  },

  // ===================== AGE 8-9: A2 Flyers =====================
  {
    id: "age8-9_1",
    ageGroup: "8-9",
    level: "A2 Flyers",
    title: "The Rainforest",
    text: "The rainforest is home to millions of animals and plants. Tall trees grow so high that their leaves block out the sun. Colourful birds fly between the branches while monkeys swing from tree to tree. On the forest floor, insects and frogs hide among the fallen leaves. Scientists believe there are still many species we have not discovered. It is important to protect these forests so that all these amazing creatures have a place to live.",
    wordCount: 82,
    readingTime: "2-3 min"
  },
  {
    id: "age8-9_2",
    ageGroup: "8-9",
    level: "A2 Flyers",
    title: "Ancient Pyramids",
    text: "Long ago, the ancient Egyptians built enormous pyramids in the desert. These huge structures were tombs for their kings, called pharaohs. The Great Pyramid of Giza is one of the Seven Wonders of the Ancient World. It took thousands of workers many years to build. The Egyptians did not have modern machines, so they used ramps and rollers to move the heavy stones. Inside the pyramids, archaeologists have found treasures, paintings, and mummies. The pyramids still stand today, reminding us of this incredible civilisation.",
    wordCount: 91,
    readingTime: "2-3 min"
  },
  {
    id: "age8-9_3",
    ageGroup: "8-9",
    level: "A2 Flyers",
    title: "The Water Cycle",
    text: "The water cycle is one of nature's most important processes. It begins when the sun heats water in oceans, lakes, and rivers. This causes the water to evaporate and rise into the sky as invisible vapour. As the vapour rises higher, it cools down and forms clouds. When the clouds become heavy with water droplets, rain or snow falls back to Earth. This water flows into rivers and streams, eventually returning to the ocean. The cycle then starts all over again, bringing fresh water to plants, animals, and people.",
    wordCount: 98,
    readingTime: "2-3 min"
  },
  {
    id: "age8-9_4",
    ageGroup: "8-9",
    level: "A2 Flyers",
    title: "The Printing Press",
    text: "The invention of the printing press changed the world forever. Before Johannes Gutenberg invented it in 1440, books had to be written by hand. This made them very expensive and rare. Only wealthy people and churches could afford them. The printing press allowed books to be made quickly and cheaply. Soon, more people could learn to read. Ideas spread faster than ever before. Libraries grew larger, and schools could teach more students. Some historians say the printing press was the most important invention of the last thousand years. It helped create the modern world we live in today.",
    wordCount: 105,
    readingTime: "2-3 min"
  },
  {
    id: "age8-9_5",
    ageGroup: "8-9",
    level: "A2 Flyers",
    title: "Bird Migration",
    text: "Every year, millions of birds make incredible journeys across the world. This is called migration. Birds travel to find food and warmer weather. The Arctic tern makes the longest journey of any animal, flying from the Arctic to the Antarctic and back again. That is a round trip of about seventy thousand kilometres. Scientists are still learning how birds know where to go. Some use the position of the sun and stars. Others follow the Earth's magnetic field. Young birds often learn the route by following their parents. Migration is one of nature's most amazing wonders.",
    wordCount: 103,
    readingTime: "2-3 min"
  },

  // ===================== AGE 10-12: B1 Preliminary =====================
  {
    id: "age10-12_1",
    ageGroup: "10-12",
    level: "B1 Preliminary",
    title: "The Amazon River",
    text: "The Amazon River is the largest river in the world by volume. It carries more water than any other river on Earth. The Amazon flows through South America, passing through Brazil, Peru, and several other countries. Its basin is home to the Amazon rainforest, which produces about twenty percent of the world's oxygen. Thousands of unique species live in and around the river, including pink dolphins, piranhas, and giant otters. Indigenous communities have lived along its banks for thousands of years. Protecting the Amazon is vital for the health of our entire planet.",
    wordCount: 99,
    readingTime: "2-3 min"
  },
  {
    id: "age10-12_2",
    ageGroup: "10-12",
    level: "B1 Preliminary",
    title: "The Human Brain",
    text: "The human brain is the most complex organ in our body. It contains about eighty-six billion neurons, which are special cells that send electrical signals to each other. These signals control everything we do, from breathing and walking to thinking and dreaming. Different parts of the brain handle different tasks. The frontal lobe helps us make decisions and solve problems. The temporal lobe processes sounds and helps us understand language. Scientists are still discovering new things about how the brain works. One amazing fact is that your brain uses about twenty percent of all the energy your body produces, even though it only weighs about one and a half kilograms.",
    wordCount: 115,
    readingTime: "2-3 min"
  },
  {
    id: "age10-12_3",
    ageGroup: "10-12",
    level: "B1 Preliminary",
    title: "Climate Change",
    text: "Climate change is one of the biggest challenges facing our world today. The Earth's temperature has been rising because of greenhouse gases released by burning fossil fuels like coal, oil, and gas. This warming is causing ice caps to melt, sea levels to rise, and weather patterns to change. Many animals and plants are struggling to survive in their changing habitats. However, people around the world are working on solutions. Scientists are developing renewable energy sources like solar and wind power. Governments are creating laws to reduce pollution. Young people are raising awareness and demanding action. Everyone can help by saving energy, reducing waste, and making environmentally friendly choices. Together, we can make a difference.",
    wordCount: 121,
    readingTime: "3-4 min"
  },
  {
    id: "age10-12_4",
    ageGroup: "10-12",
    level: "B1 Preliminary",
    title: "The Renaissance",
    text: "The Renaissance was a period of great cultural and artistic achievement in Europe. It began in Italy around the fourteenth century and spread across the continent over the next two hundred years. The word Renaissance means rebirth in French. During this time, artists, scientists, and thinkers rediscovered ideas from ancient Greece and Rome. Famous artists like Leonardo da Vinci and Michelangelo created masterpieces that are still admired today. Leonardo painted the Mona Lisa and designed flying machines. Michelangelo sculpted the statue of David and painted the ceiling of the Sistine Chapel. The Renaissance also saw advances in science, with scholars like Galileo challenging old beliefs about the universe. This period laid the foundation for the modern world.",
    wordCount: 124,
    readingTime: "3-4 min"
  },
  {
    id: "age10-12_5",
    ageGroup: "10-12",
    level: "B1 Preliminary",
    title: "Space Exploration",
    text: "Space exploration has taught us incredible things about our universe. In 1969, Neil Armstrong became the first human to walk on the Moon. Since then, we have sent robots to Mars, spacecraft past Pluto, and telescopes into deep space. The International Space Station has been orbiting Earth since 1998, with astronauts from many countries living and working together. They conduct experiments that help us understand how the human body reacts to space and develop new technologies. Recently, private companies have started building their own rockets, making space travel more accessible. Scientists hope that one day humans might live on the Moon or even Mars. Each discovery brings new questions and possibilities. The universe is vast, and we have only begun to explore it.",
    wordCount: 129,
    readingTime: "3-4 min"
  },
];

async function updatePassages() {
  console.log('🚀 Starting assessment passages update...\n');

  // Check current state
  const { data: currentSetting, error: fetchError } = await supabase
    .from('site_settings')
    .select('*')
    .eq('key', 'assessment_passages')
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching current setting:', fetchError);
    return;
  }

  if (currentSetting) {
    console.log('📋 Current passages found, updating...');

    const { error: updateError } = await supabase
      .from('site_settings')
      .update({
        value: JSON.stringify(ASSESSMENT_PASSAGES),
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'assessment_passages');

    if (updateError) {
      console.error('Error updating passages:', updateError);
      return;
    }
  } else {
    console.log('📋 No existing passages, inserting new...');

    const { error: insertError } = await supabase
      .from('site_settings')
      .insert({
        key: 'assessment_passages',
        value: JSON.stringify(ASSESSMENT_PASSAGES),
        category: 'assessment',
        description: 'Reading passages for assessment page (5 per age group)',
      });

    if (insertError) {
      console.error('Error inserting passages:', insertError);
      return;
    }
  }

  console.log('✅ Successfully updated assessment passages!\n');

  // Verify the update
  const { data: verifyData, error: verifyError } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'assessment_passages')
    .single();

  if (verifyError) {
    console.error('Error verifying:', verifyError);
    return;
  }

  const passages = JSON.parse(verifyData.value as string);
  console.log(`📊 Total passages: ${passages.length}\n`);

  // Group by age
  const byAge: Record<string, any[]> = {};
  for (const p of passages) {
    if (!byAge[p.ageGroup]) byAge[p.ageGroup] = [];
    byAge[p.ageGroup].push(p);
  }

  console.log('📚 Passages by age group:');
  for (const [age, list] of Object.entries(byAge)) {
    console.log(`   ${age}: ${list.length} passages (Level: ${list[0].level})`);
  }

  console.log('\n🎯 Sample passages (one from each age group):\n');

  const samples = ['4-5', '6-7', '8-9', '10-12'];
  for (const age of samples) {
    const sample = byAge[age]?.[0];
    if (sample) {
      console.log(`━━━ ${age} years (${sample.level}) ━━━`);
      console.log(`Title: ${sample.title}`);
      console.log(`Words: ${sample.wordCount} | Time: ${sample.readingTime}`);
      console.log(`Text: "${sample.text.substring(0, 100)}..."\n`);
    }
  }

  console.log('✅ Database update complete!');
}

updatePassages().catch(console.error);
