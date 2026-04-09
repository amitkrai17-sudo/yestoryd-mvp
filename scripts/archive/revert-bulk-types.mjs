/**
 * Revert the bulk <Database> additions from files,
 * keeping only the Database import addition (for future use).
 * Actually, remove both the import and the generic since the types file is stale.
 */

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve('.');

// Files to KEEP (manually fixed)
const KEEP_FILES = new Set([
  'lib/supabase/client.ts',
  'lib/supabase/server.ts',
  'lib/supabase/index.ts',
  'lib/supabase/database.types.ts',
  'lib/scheduling/enrollment-scheduler.ts',
  'lib/db-utils.ts',
  'app/admin/layout.tsx',
  'app/admin/site-settings/page.tsx',
  'app/admin/agreements/page.tsx',
  'app/admin/coach-groups/page.tsx',
]);

function findFiles(dir, ext) {
  const results = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (item.name === 'node_modules' || item.name === '.next') continue;
        results.push(...findFiles(fullPath, ext));
      } else if (ext.some(e => item.name.endsWith(e))) {
        results.push(fullPath);
      }
    }
  } catch { /* skip */ }
  return results;
}

let reverted = 0;
const files = findFiles(PROJECT_ROOT, ['.ts', '.tsx']);

for (const file of files) {
  const rel = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/');
  if (KEEP_FILES.has(rel)) continue;

  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Remove the Database import line we added
  content = content.replace(/import { Database } from '@\/lib\/supabase\/database\.types';\n/g, '');

  // Revert createClient<Database>( back to createClient(
  content = content.replace(/createClient<Database>\(/g, 'createClient(');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    reverted++;
  }
}

console.log(`Reverted ${reverted} files`);
