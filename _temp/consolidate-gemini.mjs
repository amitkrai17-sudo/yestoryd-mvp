import fs from 'fs';
import path from 'path';

const ROOT = 'C:/yestoryd-mvp';

const files = [
  'lib/learningEvents.ts',
  'lib/rai/intent-classifier.ts',
  'lib/rai/model-router.ts',
  'lib/whatsapp/intent/tier1-gemini.ts',
  'lib/whatsapp/handlers/faq.ts',
  'lib/whatsapp/agent/brain.ts',
  'lib/whatsapp/handlers/qualification.ts',
  'app/api/certificate/pdf/route.tsx',
  'app/api/webhooks/whatsapp-cloud/route.ts',
  'app/api/assessment/final/submit/route.ts',
  'app/api/cron/group-class-insights/route.ts',
  'app/api/coach-assessment/chat/route.ts',
  'app/api/coach-assessment/calculate-score/route.ts',
  'app/api/completion/report/[enrollmentId]/route.ts',
  'app/api/sessions/parent-checkin/route.ts',
  'app/api/coach/session-prep/route.ts',
  'app/api/learning-events/route.ts',
  'app/api/elearning/recommendations/route.ts',
  'app/api/quiz/submit/route.ts',
  'app/api/quiz/generate/route.ts',
  'app/api/assessment/retry/route.ts',
  'app/api/assessment/analyze/route.ts',
  'app/api/cron/intelligence-profile-synthesis/route.ts',
  'app/api/cron/agent-nurture/route.ts',
  'app/api/mini-challenge/generate/route.ts',
  'app/api/mini-challenge/complete/route.ts',
  'lib/gemini/session-prompts.ts',
  'lib/gemini/audio-analysis.ts',
  'lib/elearning/session-builder.ts',
  'app/api/assessment/enrolled/route.ts',
  'app/api/coach/ai-suggestion/route.ts',
  'app/api/intelligence/micro-assessment/route.ts',
  'app/api/elearning/session/[sessionId]/interact/route.ts',
  'app/api/jobs/artifact-analysis/route.ts',
  'app/api/jobs/recall-reconciliation/route.ts',
  'lib/rai/embeddings.ts',
  'lib/ai/provider.ts',
  'app/api/webhooks/aisensy/feedback/route.ts',
];

let modified = 0;
let skipped = 0;
const results = [];

for (const relPath of files) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) {
    results.push('SKIP (not found): ' + relPath);
    skipped++;
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Check if already imports getGenAI from client
  if (content.includes("from '@/lib/gemini/client'") && content.includes('getGenAI')) {
    results.push('SKIP (already done): ' + relPath);
    skipped++;
    continue;
  }

  const importLine = "import { getGenAI } from '@/lib/gemini/client';";

  // === Special cases ===

  if (relPath === 'lib/rai/embeddings.ts') {
    // Has its own getGenAI singleton - replace with import
    content = content.replace(
      /\/\/ Lazy initialization[^\n]*\nlet _genAI: GoogleGenerativeAI \| null = null;\nfunction getGenAI\(\): GoogleGenerativeAI \{[\s\S]*?\n\}\n/,
      ''
    );
    content = content.replace(
      "import { GoogleGenerativeAI } from '@google/generative-ai';",
      importLine
    );
  } else if (relPath === 'lib/ai/provider.ts') {
    content = content.replace(
      /function getGeminiClient\(model: string\) \{\n  const apiKey = process\.env\.GEMINI_API_KEY;\n  if \(!apiKey\) \{\n    throw new Error\('GEMINI_API_KEY not configured'\);\n  \}\n  const genAI = new GoogleGenerativeAI\(apiKey\);\n  return genAI\.getGenerativeModel\(\{ model \}\);\n\}/,
      'function getGeminiClient(model: string) {\n  return getGenAI().getGenerativeModel({ model });\n}'
    );
    content = content.replace(
      "import { GoogleGenerativeAI } from '@google/generative-ai';",
      importLine
    );
  } else if (relPath === 'app/api/webhooks/aisensy/feedback/route.ts') {
    // Replace function-scoped instantiation
    content = content.replace(
      /    const genAI = new GoogleGenerativeAI\(apiKey\);\n    const model = genAI\.getGenerativeModel/,
      '    const model = getGenAI().getGenerativeModel'
    );
    // Add import after first import
    if (!content.includes(importLine)) {
      content = content.replace(
        /(import [^\n]+ from [^\n]+;\n)/,
        '$1' + importLine + '\n'
      );
    }
  } else if (relPath === 'app/api/jobs/artifact-analysis/route.ts' || relPath === 'app/api/jobs/recall-reconciliation/route.ts') {
    content = content.replace(
      /const getGenAI = \(\) => new GoogleGenerativeAI\(process\.env\.GEMINI_API_KEY!\);\n?/,
      ''
    );
    content = content.replace(
      "import { GoogleGenerativeAI } from '@google/generative-ai';",
      importLine
    );
  } else {
    // === Standard cases ===

    // Add import
    if (content.includes("import { GoogleGenerativeAI }")) {
      content = content.replace(
        "import { GoogleGenerativeAI } from '@google/generative-ai';",
        importLine
      );
    } else if (content.match(/import \{[^}]*GoogleGenerativeAI[^}]*\} from '@google\/generative-ai'/)) {
      // Has other imports from the package - add our import after, remove GoogleGenerativeAI
      content = content.replace(
        /import \{([^}]*)\} from '@google\/generative-ai'/,
        (match, imports) => {
          const remaining = imports.replace(/,?\s*GoogleGenerativeAI\s*,?/, '').trim().replace(/^,\s*/, '').replace(/,\s*$/, '');
          if (remaining) {
            return 'import { ' + remaining + " } from '@google/generative-ai';\n" + importLine;
          }
          return importLine;
        }
      );
    } else {
      // Add after first import
      content = content.replace(
        /(import [^\n]+ from [^\n]+;\n)/,
        '$1' + importLine + '\n'
      );
    }

    // Remove module-level const genAI = new GoogleGenerativeAI(...)
    content = content.replace(
      /^const genAI = new GoogleGenerativeAI\(process\.env\.GEMINI_API_KEY[^)]*\);?\s*\n/m,
      ''
    );

    // Replace function-scoped: const genAI = new GoogleGenerativeAI(...) with const genAI = getGenAI()
    content = content.replace(
      /(\s+)const genAI = new GoogleGenerativeAI\(process\.env\.GEMINI_API_KEY[^)]*\);/g,
      '$1const genAI = getGenAI();'
    );

    // Replace return new GoogleGenerativeAI(...)
    content = content.replace(
      /return new GoogleGenerativeAI\(process\.env\.GEMINI_API_KEY[^)]*\);/g,
      'return getGenAI();'
    );

    // If module-level genAI was removed and references remain, replace genAI. with getGenAI().
    if (!content.match(/(?:const|let|var)\s+genAI\s*=/) && content.includes('genAI.')) {
      content = content.replace(/\bgenAI\./g, 'getGenAI().');
    }
  }

  // Remove unused GoogleGenerativeAI import if no longer referenced
  if (!content.includes('new GoogleGenerativeAI') && !content.includes(': GoogleGenerativeAI')) {
    content = content.replace(
      /import \{ GoogleGenerativeAI \} from '@google\/generative-ai';\n?/g,
      ''
    );
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    modified++;
    results.push('MODIFIED: ' + relPath);
  } else {
    results.push('NO CHANGE: ' + relPath);
    skipped++;
  }
}

console.log('\nResults: ' + modified + ' modified, ' + skipped + ' skipped\n');
results.forEach(r => console.log(r));
