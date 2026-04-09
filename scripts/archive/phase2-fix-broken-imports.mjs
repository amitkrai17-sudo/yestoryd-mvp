/**
 * Fix imports that were incorrectly inserted into multi-line import blocks.
 * Pattern to fix:
 *   import {
 *   import { supabase } from '@/lib/supabase/client';
 *     SomeIcon,
 *
 * Should become:
 *   import { supabase } from '@/lib/supabase/client';
 *   import {
 *     SomeIcon,
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let fixed = 0;

function findFiles(dir, pattern, results = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (['node_modules', '.next', '.git', 'scripts'].includes(item.name)) continue;
      findFiles(fullPath, pattern, results);
    } else if (pattern.test(item.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = findFiles(ROOT, /\.(ts|tsx)$/);

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Pattern: "import {\n" followed by a misplaced import line, then continuation of the original import
  // The misplaced import matches: import { X } from '@/lib/supabase/...';
  const brokenPattern = /^(import \{)\n(import \{[^}]+\} from '@\/lib\/supabase\/[^']+';)\n/gm;

  if (brokenPattern.test(content)) {
    content = content.replace(brokenPattern, (match, importOpen, misplacedImport) => {
      return `${misplacedImport}\n${importOpen}\n`;
    });
  }

  // Also fix: same pattern but with createAdminClient
  const brokenPattern2 = /^(import \{)\n(import \{ createAdminClient \} from '@\/lib\/supabase\/admin';)\n/gm;
  if (brokenPattern2.test(content)) {
    content = content.replace(brokenPattern2, (match, importOpen, misplacedImport) => {
      return `${misplacedImport}\n${importOpen}\n`;
    });
  }

  // Also handle the case where the import was inserted between "import {" and the next line
  // without newline properly. Pattern:  import {\nimport { X } from '...';\n  Icon,
  const brokenPattern3 = /(import \{)\r?\nimport \{([^}]+)\} from '(@\/lib\/supabase\/[^']+)';\r?\n/g;
  const matches = [...content.matchAll(brokenPattern3)];
  if (matches.length > 0) {
    for (const m of matches) {
      const misplacedImport = `import {${m[2]}} from '${m[3]}';`;
      content = content.replace(m[0], `${misplacedImport}\n${m[1]}\n`);
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    fixed++;
    console.log(`FIXED: ${path.relative(ROOT, filePath).replace(/\\/g, '/')}`);
  }
}

console.log(`\nTotal files fixed: ${fixed}`);
