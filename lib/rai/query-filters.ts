// file: lib/rai/query-filters.ts
// rAI v2.0 - Extract structured filters from natural language queries

import { QueryFilters } from './types';

/**
 * Extract structured filters from a natural language query
 * Used for hybrid search to combine SQL filtering with vector search
 */
export function extractQueryFilters(query: string): QueryFilters {
  const filters: QueryFilters = {
    keywords: [],
  };
  
  const lowerQuery = query.toLowerCase();
  const now = new Date();
  
  // ───────────────────────────────────────────────────────────────
  // DATE EXTRACTION
  // ───────────────────────────────────────────────────────────────
  
  // Today
  if (/\btoday\b/.test(lowerQuery)) {
    filters.dateRange = {
      from: startOfDay(now),
      to: endOfDay(now),
    };
  }
  // Yesterday
  else if (/\byesterday\b/.test(lowerQuery)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    filters.dateRange = {
      from: startOfDay(yesterday),
      to: endOfDay(yesterday),
    };
  }
  // This week
  else if (/\bthis week\b/.test(lowerQuery)) {
    filters.dateRange = {
      from: startOfWeek(now),
      to: now,
    };
  }
  // Last week
  else if (/\blast week\b/.test(lowerQuery)) {
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    filters.dateRange = {
      from: startOfWeek(lastWeekStart),
      to: endOfWeek(lastWeekStart),
    };
  }
  // Last month
  else if (/\blast month\b/.test(lowerQuery)) {
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    filters.dateRange = {
      from: startOfMonth(lastMonth),
      to: endOfMonth(lastMonth),
    };
  }
  // This month
  else if (/\bthis month\b/.test(lowerQuery)) {
    filters.dateRange = {
      from: startOfMonth(now),
      to: now,
    };
  }
  // Last session / recent session (last 7 days)
  else if (/\b(last|recent|latest) session\b/.test(lowerQuery)) {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    filters.dateRange = {
      from: sevenDaysAgo,
      to: now,
    };
  }
  // Last X days
  else if (/\blast (\d+) days?\b/.test(lowerQuery)) {
    const match = lowerQuery.match(/\blast (\d+) days?\b/);
    if (match) {
      const days = parseInt(match[1]);
      const daysAgo = new Date(now);
      daysAgo.setDate(daysAgo.getDate() - days);
      filters.dateRange = {
        from: daysAgo,
        to: now,
      };
    }
  }
  // Specific weekday (last Monday, last Tuesday, etc.)
  else if (/\blast (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lowerQuery)) {
    const dayMatch = lowerQuery.match(/\blast (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (dayMatch) {
      const targetDay = getLastWeekday(dayMatch[1]);
      filters.dateRange = {
        from: startOfDay(targetDay),
        to: endOfDay(targetDay),
      };
    }
  }
  
  // ───────────────────────────────────────────────────────────────
  // EVENT TYPE EXTRACTION
  // ───────────────────────────────────────────────────────────────
  
  if (/\b(assessment|test|score|reading level|initial score)\b/.test(lowerQuery)) {
    filters.eventType = 'assessment';
  } else if (/\b(session|class|lesson|coaching|tutoring)\b/.test(lowerQuery)) {
    filters.eventType = 'session';
  } else if (/\b(quiz|quizzes)\b/.test(lowerQuery)) {
    filters.eventType = 'quiz';
  } else if (/\b(milestone|achievement|badge)\b/.test(lowerQuery)) {
    filters.eventType = 'milestone';
  }
  
  // ───────────────────────────────────────────────────────────────
  // KEYWORD EXTRACTION (for boosting)
  // ───────────────────────────────────────────────────────────────
  
  const keywordPatterns: Array<{ pattern: RegExp; keyword: string }> = [
    // Phonics-related
    { pattern: /\bphonics?\b/i, keyword: 'phonics' },
    { pattern: /\bvowels?\b/i, keyword: 'vowel' },
    { pattern: /\bconsonants?\b/i, keyword: 'consonant' },
    { pattern: /\bblends?\b/i, keyword: 'blend' },
    { pattern: /\bdigraphs?\b/i, keyword: 'digraph' },
    { pattern: /\bsight words?\b/i, keyword: 'sight word' },
    { pattern: /\bcvc\b/i, keyword: 'cvc' },
    { pattern: /\bletter sounds?\b/i, keyword: 'letter sound' },
    
    // Fluency-related
    { pattern: /\bfluency\b/i, keyword: 'fluency' },
    { pattern: /\breading speed\b/i, keyword: 'reading speed' },
    { pattern: /\bwpm\b/i, keyword: 'wpm' },
    { pattern: /\bwords per minute\b/i, keyword: 'wpm' },
    { pattern: /\bpacing\b/i, keyword: 'pacing' },
    { pattern: /\bexpression\b/i, keyword: 'expression' },
    
    // Comprehension-related
    { pattern: /\bcomprehension\b/i, keyword: 'comprehension' },
    { pattern: /\bunderstanding\b/i, keyword: 'comprehension' },
    { pattern: /\bmeaning\b/i, keyword: 'comprehension' },
    
    // Pronunciation-related
    { pattern: /\bpronunciation\b/i, keyword: 'pronunciation' },
    { pattern: /\bclarity\b/i, keyword: 'clarity' },
    { pattern: /\bspeech\b/i, keyword: 'speech' },
    
    // Progress-related
    { pattern: /\bprogress\b/i, keyword: 'progress' },
    { pattern: /\bimprove(ment|d)?\b/i, keyword: 'improve' },
    { pattern: /\bstruggl(e|ing|es)\b/i, keyword: 'struggle' },
    { pattern: /\bdifficult(y|ies)?\b/i, keyword: 'difficult' },
    { pattern: /\bchalleng(e|ing|es)\b/i, keyword: 'challenge' },
    
    // Homework-related
    { pattern: /\bhomework\b/i, keyword: 'homework' },
    { pattern: /\bpractice\b/i, keyword: 'practice' },
    { pattern: /\bassignment\b/i, keyword: 'homework' },
    
    // Engagement-related
    { pattern: /\bengag(ement|ed|ing)\b/i, keyword: 'engagement' },
    { pattern: /\battention\b/i, keyword: 'attention' },
    { pattern: /\bfocus(ed|ing)?\b/i, keyword: 'focus' },
    { pattern: /\bconfiden(ce|t)\b/i, keyword: 'confidence' },
  ];
  
  filters.keywords = keywordPatterns
    .filter(({ pattern }) => pattern.test(query))
    .map(({ keyword }) => keyword);
  
  // Remove duplicates
  filters.keywords = [...new Set(filters.keywords)];
  
  return filters;
}

// ───────────────────────────────────────────────────────────────
// DATE HELPER FUNCTIONS
// ───────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getLastWeekday(dayName: string): Date {
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  
  const targetDay = days[dayName.toLowerCase()];
  const today = new Date();
  const currentDay = today.getDay();
  
  let diff = currentDay - targetDay;
  if (diff <= 0) diff += 7; // Go back to last week if today or future
  
  const result = new Date(today);
  result.setDate(today.getDate() - diff);
  return result;
}

/**
 * Extract child name from query if mentioned
 */
export function extractChildName(query: string, knownChildren: string[]): string | null {
  const lowerQuery = query.toLowerCase();
  
  for (const childName of knownChildren) {
    if (lowerQuery.includes(childName.toLowerCase())) {
      return childName;
    }
  }
  
  // Try to extract name patterns like "How is [Name] doing?"
  const namePatterns = [
    /how is (\w+) doing/i,
    /how'?s (\w+) doing/i,
    /update on (\w+)/i,
    /about (\w+)'?s? (session|progress|reading)/i,
    /(\w+)'?s? (session|progress|reading)/i,
    /prepare.*for.*session with (\w+)/i,
    /session with (\w+)/i,
  ];
  
  for (const pattern of namePatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const potentialName = match[1];
      // Check if it looks like a name (starts with capital, not a common word)
      const commonWords = ['my', 'the', 'a', 'an', 'this', 'that', 'their', 'our'];
      if (!commonWords.includes(potentialName.toLowerCase()) && potentialName.length > 1) {
        return potentialName;
      }
    }
  }
  
  return null;
}
