// file: lib/rai/query-filters.ts
// rAI v2.0 - Extract structured filters from natural language queries

import { QueryFilters } from './types';

export function extractQueryFilters(query: string): QueryFilters {
  const filters: QueryFilters = {
    keywords: [],
  };
  
  const lowerQuery = query.toLowerCase();
  const now = new Date();
  
  // DATE EXTRACTION
  if (/\btoday\b/.test(lowerQuery)) {
    filters.dateRange = {
      from: startOfDay(now),
      to: endOfDay(now),
    };
  }
  else if (/\byesterday\b/.test(lowerQuery)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    filters.dateRange = {
      from: startOfDay(yesterday),
      to: endOfDay(yesterday),
    };
  }
  else if (/\bthis week\b/.test(lowerQuery)) {
    filters.dateRange = {
      from: startOfWeek(now),
      to: now,
    };
  }
  else if (/\blast week\b/.test(lowerQuery)) {
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    filters.dateRange = {
      from: startOfWeek(lastWeekStart),
      to: endOfWeek(lastWeekStart),
    };
  }
  else if (/\blast month\b/.test(lowerQuery)) {
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    filters.dateRange = {
      from: startOfMonth(lastMonth),
      to: endOfMonth(lastMonth),
    };
  }
  else if (/\bthis month\b/.test(lowerQuery)) {
    filters.dateRange = {
      from: startOfMonth(now),
      to: now,
    };
  }
  else if (/\b(last|recent|latest) session\b/.test(lowerQuery)) {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    filters.dateRange = {
      from: sevenDaysAgo,
      to: now,
    };
  }
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
  
  // EVENT TYPE EXTRACTION
  if (/\b(assessment|test|score|reading level|initial score)\b/.test(lowerQuery)) {
    filters.eventType = 'assessment';
  } else if (/\b(session|class|lesson|coaching|tutoring)\b/.test(lowerQuery)) {
    filters.eventType = 'session';
  } else if (/\b(quiz|quizzes)\b/.test(lowerQuery)) {
    filters.eventType = 'quiz';
  } else if (/\b(milestone|achievement|badge)\b/.test(lowerQuery)) {
    filters.eventType = 'milestone';
  }
  
  // KEYWORD EXTRACTION
  const keywordPatterns: Array<{ pattern: RegExp; keyword: string }> = [
    { pattern: /\bphonics?\b/i, keyword: 'phonics' },
    { pattern: /\bvowels?\b/i, keyword: 'vowel' },
    { pattern: /\bconsonants?\b/i, keyword: 'consonant' },
    { pattern: /\bblends?\b/i, keyword: 'blend' },
    { pattern: /\bdigraphs?\b/i, keyword: 'digraph' },
    { pattern: /\bsight words?\b/i, keyword: 'sight word' },
    { pattern: /\bcvc\b/i, keyword: 'cvc' },
    { pattern: /\bletter sounds?\b/i, keyword: 'letter sound' },
    { pattern: /\bfluency\b/i, keyword: 'fluency' },
    { pattern: /\breading speed\b/i, keyword: 'reading speed' },
    { pattern: /\bwpm\b/i, keyword: 'wpm' },
    { pattern: /\bwords per minute\b/i, keyword: 'wpm' },
    { pattern: /\bcomprehension\b/i, keyword: 'comprehension' },
    { pattern: /\bpronunciation\b/i, keyword: 'pronunciation' },
    { pattern: /\bclarity\b/i, keyword: 'clarity' },
    { pattern: /\bprogress\b/i, keyword: 'progress' },
    { pattern: /\bimprove(ment|d)?\b/i, keyword: 'improve' },
    { pattern: /\bstruggl(e|ing|es)\b/i, keyword: 'struggle' },
    { pattern: /\bhomework\b/i, keyword: 'homework' },
    { pattern: /\bpractice\b/i, keyword: 'practice' },
    { pattern: /\bengag(ement|ed|ing)\b/i, keyword: 'engagement' },
    { pattern: /\bconfiden(ce|t)\b/i, keyword: 'confidence' },
  ];
  
  filters.keywords = keywordPatterns
    .filter(({ pattern }) => pattern.test(query))
    .map(({ keyword }) => keyword);
  
  filters.keywords = Array.from(new Set(filters.keywords));
  
  return filters;
}

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
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

export function extractChildName(query: string, knownChildren: string[]): string | null {
  const lowerQuery = query.toLowerCase();
  
  for (const childName of knownChildren) {
    if (lowerQuery.includes(childName.toLowerCase())) {
      return childName;
    }
  }
  
  return null;
}