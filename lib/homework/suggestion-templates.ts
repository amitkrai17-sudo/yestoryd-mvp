// ============================================================
// FILE: lib/homework/suggestion-templates.ts
// PURPOSE: Skill-based homework suggestion templates for coaches
// ============================================================

// Maps skill category slugs (from skill_categories table) to homework suggestions
// Coaches tap a chip to populate the homework text field, then can edit
const HOMEWORK_SUGGESTIONS: Record<string, string[]> = {
  // Phonics / Letter sounds
  phonics_letter_sounds: [
    'Practice reading words with today\'s sound pattern aloud (10 words)',
    'Find 5 objects at home that start with the target sound',
    'Write 5 words with the sound pattern in a notebook',
  ],
  phonemic_awareness: [
    'Play a rhyming game with a family member (5 minutes)',
    'Clap the syllables in 10 different words',
    'Find 5 words that start with the same sound as your name',
  ],
  // Reading fluency
  reading_fluency: [
    'Read one page from school textbook aloud to parent (time it)',
    'Re-read today\'s passage 3 times, aiming to get faster each time',
    'Read a short story aloud and tell parent what happened',
  ],
  fluency: [
    'Read one page from school textbook aloud to parent (time it)',
    'Re-read today\'s passage 3 times, aiming to get faster each time',
    'Read a short story aloud and tell parent what happened',
  ],
  // Comprehension
  reading_comprehension: [
    'Read a short story and tell parent 3 things that happened',
    'Draw a picture of the main character and write 2 sentences about them',
    'Write 3 questions about a story you read today',
  ],
  comprehension: [
    'Read a short story and tell parent 3 things that happened',
    'Draw a picture of the main character and write 2 sentences about them',
    'Write 3 questions about a story you read today',
  ],
  // Vocabulary
  vocabulary_building: [
    'Use 3 new words from today in sentences (write in notebook)',
    'Find meanings of 5 new words and draw pictures for each',
    'Make word cards for new vocabulary — word on front, meaning on back',
  ],
  vocabulary: [
    'Use 3 new words from today in sentences (write in notebook)',
    'Find meanings of 5 new words and draw pictures for each',
    'Make word cards for new vocabulary — word on front, meaning on back',
  ],
  // Creative writing
  creative_writing: [
    'Write 5 sentences about your favourite animal',
    'Finish the story: "One day, a little bird found a magic seed..."',
    'Write about what you did today in 3-4 sentences',
  ],
  writing: [
    'Write 5 sentences about your favourite animal',
    'Finish the story: "One day, a little bird found a magic seed..."',
    'Write about what you did today in 3-4 sentences',
  ],
  // Grammar
  grammar_syntax: [
    'Circle all the nouns in one paragraph of your textbook',
    'Write 5 sentences using "is", "am", and "are" correctly',
    'Rewrite 3 sentences changing past to present tense',
  ],
  grammar: [
    'Circle all the nouns in one paragraph of your textbook',
    'Write 5 sentences using "is", "am", and "are" correctly',
    'Rewrite 3 sentences changing past to present tense',
  ],
  // Pronunciation
  pronunciation: [
    'Practice saying 10 difficult words from today\'s session 5 times each',
    'Record yourself reading a paragraph and listen back',
    'Ask parent to say a word, then repeat it 3 times clearly',
  ],
  // Story / narrative
  story_analysis: [
    'Pick a story character and write why you like or dislike them',
    'Tell parent what the moral/lesson of today\'s story was',
    'Write a different ending for the story we read today',
  ],
  // Decoding
  decoding: [
    'Find 5 new words in a book and sound them out letter by letter',
    'Write 10 CVC words (consonant-vowel-consonant) and read them aloud',
    'Practice blending 3-letter words: say each sound, then blend them',
  ],
  // Sight words
  sight_words: [
    'Practice 10 sight words — write on cards, mix up, read fast',
    'Find sight words in a storybook and circle or point to them',
    'Write each sight word in a sentence',
  ],
};

const GENERIC_SUGGESTIONS = [
  'Read for 15 minutes from any book at home',
  'Practice writing 5 new words in a notebook',
  'Read one page aloud to a family member',
];

/**
 * Get homework suggestions for a set of skill IDs/slugs.
 * Returns up to 3 unique suggestions matching the session's skills.
 */
export function getHomeworkSuggestions(skillSlugs: string[]): string[] {
  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const slug of skillSlugs) {
    // Try exact match, then partial match
    const templates = HOMEWORK_SUGGESTIONS[slug]
      || HOMEWORK_SUGGESTIONS[slug.toLowerCase()]
      || Object.entries(HOMEWORK_SUGGESTIONS).find(([key]) =>
        slug.toLowerCase().includes(key) || key.includes(slug.toLowerCase())
      )?.[1];

    if (templates) {
      for (const t of templates) {
        if (!seen.has(t) && suggestions.length < 3) {
          seen.add(t);
          suggestions.push(t);
        }
      }
    }
  }

  // Fill with generic if not enough
  if (suggestions.length < 2) {
    for (const t of GENERIC_SUGGESTIONS) {
      if (!seen.has(t) && suggestions.length < 3) {
        seen.add(t);
        suggestions.push(t);
      }
    }
  }

  return suggestions.slice(0, 3);
}
