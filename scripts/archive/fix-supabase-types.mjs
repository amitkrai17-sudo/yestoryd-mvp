/**
 * Batch fix: Add <Database> generic to all createClient() calls
 * and add the Database import where missing.
 *
 * Run: node scripts/fix-supabase-types.mjs
 */

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve('.');

// Files to skip (already typed or special)
const SKIP_FILES = new Set([
  'lib/supabase/client.ts',
  'lib/supabase/server.ts',
  'lib/supabase/index.ts',
  'lib/supabase/database.types.ts',
  'lib/scheduling/enrollment-scheduler.ts', // Already fixed manually
  'lib/db-utils.ts', // Already fixed manually
  'node_modules',
  '.next',
]);

function shouldSkip(filePath) {
  const rel = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
  return SKIP_FILES.has(rel) || rel.includes('node_modules') || rel.includes('.next');
}

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

function fixFile(filePath) {
  if (shouldSkip(filePath)) return null;

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Check if file has untyped createClient(
  if (!content.includes('createClient(') || content.includes('createClient<')) {
    return null;
  }

  // Check if it actually creates a Supabase client (not some other createClient)
  if (!content.includes('@supabase/supabase-js') &&
      !content.includes('@/lib/supabase') &&
      !content.includes('supabase')) {
    return null;
  }

  const changes = [];

  // Add Database import if not already present
  if (!content.includes("from '@/lib/supabase/database.types'") &&
      !content.includes('from "@/lib/supabase/database.types"') &&
      !content.includes("from './database.types'")) {

    // Find the right place to add the import
    // Try to add after the @supabase/supabase-js import
    const supabaseImportMatch = content.match(/import\s+\{[^}]*\}\s+from\s+['"]@supabase\/supabase-js['"];?\n/);
    if (supabaseImportMatch) {
      const insertPos = supabaseImportMatch.index + supabaseImportMatch[0].length;
      content = content.slice(0, insertPos) +
        "import { Database } from '@/lib/supabase/database.types';\n" +
        content.slice(insertPos);
      changes.push('Added Database import');
    } else {
      // Add at the top of imports
      const firstImport = content.match(/^import\s/m);
      if (firstImport) {
        content = content.slice(0, firstImport.index) +
          "import { Database } from '@/lib/supabase/database.types';\n" +
          content.slice(firstImport.index);
        changes.push('Added Database import (top)');
      }
    }
  }

  // Replace createClient( with createClient<Database>( — but only for Supabase calls
  // Match patterns like: createClient(\n  process.env or createClient(url, or createClient(supabase
  const createClientPattern = /createClient\(\s*\n?\s*(process\.env|supabaseUrl|url|SUPABASE)/g;
  if (createClientPattern.test(content)) {
    content = content.replace(
      /createClient\(\s*\n?\s*(process\.env|supabaseUrl|url|SUPABASE)/g,
      'createClient<Database>(\n  $1'
    );
    changes.push('Added <Database> generic to createClient');
  } else {
    // Simpler pattern: createClient(var, var)
    content = content.replace(
      /createClient\(([^<)][^)]*)\)/g,
      (match, args) => {
        // Don't replace if already has generic or if it's not a Supabase call
        if (match.includes('<') || !args.trim()) return match;
        return `createClient<Database>(${args})`;
      }
    );
    if (content !== original && !changes.length) {
      changes.push('Added <Database> generic to createClient');
    }
  }

  if (content === original) return null;

  fs.writeFileSync(filePath, content, 'utf8');
  return changes;
}

// Main
const files = findFiles(PROJECT_ROOT, ['.ts', '.tsx']);
let fixedCount = 0;
const fixedFiles = [];

for (const file of files) {
  const changes = fixFile(file);
  if (changes) {
    fixedCount++;
    const rel = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/');
    fixedFiles.push({ file: rel, changes });
    console.log(`Fixed: ${rel} — ${changes.join(', ')}`);
  }
}

console.log(`\nTotal files fixed: ${fixedCount}`);
console.log('\nFixed files:');
fixedFiles.forEach(f => console.log(`  ${f.file}`));
