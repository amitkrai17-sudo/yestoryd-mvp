/**
 * Phase 2: Batch refactor createClient to shared helpers
 *
 * Patterns handled:
 * 1. Service role (module-scope): createClient(url, SERVICE_ROLE_KEY) → createAdminClient()
 * 2. Service role (with Database generic): createClient<Database>(url, SERVICE_ROLE_KEY) → createAdminClient()
 * 3. Anon key (module-scope): createClient(url, ANON_KEY) → import { supabase } from client
 * 4. Multi-line createClient calls
 * 5. Files importing SupabaseClient alongside createClient
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Files to skip (already properly typed or special)
const SKIP_FILES = new Set([
  'lib/supabase/client.ts',
  'lib/supabase/server.ts',
  'lib/supabase/admin.ts',
  'lib/supabase/database.types.ts',
]);

const changes = [];
const skipped = [];
const errors = [];

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

function processFile(filePath) {
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');

  // Skip known files
  if (SKIP_FILES.has(relPath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Check if file imports from @supabase/supabase-js
  if (!content.includes("from '@supabase/supabase-js'") && !content.includes('from "@supabase/supabase-js"')) {
    return;
  }

  // Check if file already uses shared helpers properly
  if (content.includes("from '@/lib/supabase/admin'") || content.includes("from '@/lib/supabase/server'")) {
    // Already migrated, but might still have @supabase/supabase-js import for types
    if (!content.includes('createClient(')) {
      skipped.push({ file: relPath, reason: 'already uses shared helper' });
      return;
    }
  }

  // Determine if service role or anon key
  const usesServiceRole = content.includes('SUPABASE_SERVICE_ROLE_KEY');
  const usesAnonKey = content.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!usesServiceRole && !usesAnonKey) {
    // File imports createClient but doesn't create any — might just import types
    skipped.push({ file: relPath, reason: 'imports createClient but no client creation found' });
    return;
  }

  const fileChanges = [];

  // ============================================================
  // STEP 1: Remove the createClient(...) call(s) and capture var name
  // ============================================================

  // Pattern: const/let varName = createClient<Database?>(\n  url,\n  key\n);
  // Handles both single-line and multi-line
  const createClientRegex = /(?:const|let)\s+(\w+)\s*=\s*createClient(?:<\w+>)?\(\s*(?:process\.env\.NEXT_PUBLIC_SUPABASE_URL!?|process\.env\['NEXT_PUBLIC_SUPABASE_URL'\]!?)\s*,\s*(?:process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY)!?|process\.env\['(?:SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY)'\]!?)\s*(?:,\s*\{[^}]*\}\s*)?\);?\s*\n?/g;

  let clientVarName = null;
  let isServiceRole = false;

  const matches = [...content.matchAll(createClientRegex)];

  if (matches.length === 0) {
    // Try a more lenient multiline regex
    const multiLineRegex = /(?:const|let)\s+(\w+)\s*=\s*createClient(?:<\w+>)?\(\s*\n\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!?\s*,\s*\n\s*process\.env\.(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY)!?\s*\n?\s*\);?\s*\n?/g;
    const multiMatches = [...content.matchAll(multiLineRegex)];

    if (multiMatches.length === 0) {
      // Even more lenient - handles extra whitespace and options objects
      const superLenientRegex = /(?:const|let)\s+(\w+)\s*=\s*createClient(?:<\w+>)?\(\s*\n?\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!?\s*,\s*\n?\s*process\.env\.(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY)!?[\s\S]*?\);?\s*\n/g;
      const superMatches = [...content.matchAll(superLenientRegex)];

      if (superMatches.length === 0) {
        skipped.push({ file: relPath, reason: 'createClient pattern not matched by regex' });
        return;
      }

      for (const m of superMatches) {
        clientVarName = m[1];
        isServiceRole = m[2] === 'SUPABASE_SERVICE_ROLE_KEY';
        content = content.replace(m[0], '');
        fileChanges.push(`removed createClient call (var: ${clientVarName})`);
      }
    } else {
      for (const m of multiMatches) {
        clientVarName = m[1];
        isServiceRole = m[2] === 'SUPABASE_SERVICE_ROLE_KEY';
        content = content.replace(m[0], '');
        fileChanges.push(`removed createClient call (var: ${clientVarName})`);
      }
    }
  } else {
    for (const m of matches) {
      clientVarName = m[1];
      isServiceRole = content.slice(m.index, m.index + m[0].length).includes('SERVICE_ROLE_KEY');
      content = content.replace(m[0], '');
      fileChanges.push(`removed createClient call (var: ${clientVarName})`);
    }
  }

  if (!clientVarName) {
    skipped.push({ file: relPath, reason: 'could not extract variable name' });
    return;
  }

  // ============================================================
  // STEP 2: Update the import line
  // ============================================================

  // Check what else is imported from @supabase/supabase-js
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@supabase\/supabase-js['"];?\s*\n?/;
  const importMatch = content.match(importRegex);

  if (importMatch) {
    const imports = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    const otherImports = imports.filter(i => i !== 'createClient');

    if (otherImports.length > 0) {
      // Keep the import line but remove createClient
      content = content.replace(importMatch[0], `import { ${otherImports.join(', ')} } from '@supabase/supabase-js';\n`);
      fileChanges.push(`kept @supabase/supabase-js import for: ${otherImports.join(', ')}`);
    } else {
      // Remove the entire import line
      content = content.replace(importMatch[0], '');
      fileChanges.push('removed @supabase/supabase-js import');
    }
  }

  // ============================================================
  // STEP 3: Add the appropriate shared helper import
  // ============================================================

  if (isServiceRole) {
    // Add createAdminClient import
    const newImport = `import { createAdminClient } from '@/lib/supabase/admin';\n`;
    const clientDecl = `const ${clientVarName} = createAdminClient();\n`;

    // Find the right place to insert (after last import)
    const lastImportIdx = content.lastIndexOf('\nimport ');
    if (lastImportIdx !== -1) {
      const lineEnd = content.indexOf('\n', lastImportIdx + 1);
      // Check if there's a semicolon at the line end or quote
      const nextLineEnd = content.indexOf('\n', lineEnd + 1);
      content = content.slice(0, lineEnd + 1) + newImport + '\n' + clientDecl + content.slice(lineEnd + 1);
    } else {
      content = newImport + '\n' + clientDecl + content;
    }
    fileChanges.push(`added createAdminClient import + const ${clientVarName}`);

    // Remove Database import if it exists and isn't used elsewhere
    // Check if Database is used anywhere else in the file (besides the removed createClient line)
    const dbImportRegex = /import\s*\{\s*Database\s*\}\s*from\s*['"]@\/lib\/supabase\/database\.types['"];?\s*\n?/;
    const dbImportMatch = content.match(dbImportRegex);
    if (dbImportMatch) {
      // Count remaining Database references (excluding imports)
      const contentWithoutImport = content.replace(dbImportMatch[0], '');
      const dbRefCount = (contentWithoutImport.match(/\bDatabase\b/g) || []).length;
      if (dbRefCount === 0) {
        content = content.replace(dbImportMatch[0], '');
        fileChanges.push('removed unused Database import');
      }
    }
  } else {
    // Anon key — use supabase singleton from client.ts
    if (clientVarName === 'supabase') {
      const newImport = `import { supabase } from '@/lib/supabase/client';\n`;
      const lastImportIdx = content.lastIndexOf('\nimport ');
      if (lastImportIdx !== -1) {
        const lineEnd = content.indexOf('\n', lastImportIdx + 1);
        content = content.slice(0, lineEnd + 1) + newImport + content.slice(lineEnd + 1);
      } else {
        content = newImport + content;
      }
      fileChanges.push('added supabase import from client.ts');
    } else {
      // Different variable name — import getSupabaseClient
      const newImport = `import { getSupabaseClient } from '@/lib/supabase/client';\n`;
      const clientDecl = `const ${clientVarName} = getSupabaseClient();\n`;
      const lastImportIdx = content.lastIndexOf('\nimport ');
      if (lastImportIdx !== -1) {
        const lineEnd = content.indexOf('\n', lastImportIdx + 1);
        content = content.slice(0, lineEnd + 1) + newImport + clientDecl + content.slice(lineEnd + 1);
      } else {
        content = newImport + clientDecl + content;
      }
      fileChanges.push(`added getSupabaseClient import + const ${clientVarName}`);
    }

    // Remove Database import if unused
    const dbImportRegex = /import\s*\{\s*Database\s*\}\s*from\s*['"]@\/lib\/supabase\/database\.types['"];?\s*\n?/;
    const dbImportMatch = content.match(dbImportRegex);
    if (dbImportMatch) {
      const contentWithoutImport = content.replace(dbImportMatch[0], '');
      const dbRefCount = (contentWithoutImport.match(/\bDatabase\b/g) || []).length;
      if (dbRefCount === 0) {
        content = content.replace(dbImportMatch[0], '');
        fileChanges.push('removed unused Database import');
      }
    }
  }

  // ============================================================
  // STEP 4: Clean up blank lines (max 2 consecutive)
  // ============================================================
  content = content.replace(/\n{4,}/g, '\n\n\n');

  // Write if changed
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    changes.push({ file: relPath, changes: fileChanges, isServiceRole });
  }
}

// ============================================================
// MAIN
// ============================================================

console.log('Phase 2: Batch refactor createClient to shared helpers');
console.log('='.repeat(60));

const files = findFiles(ROOT, /\.(ts|tsx)$/);
console.log(`Found ${files.length} TypeScript files to scan`);

for (const file of files) {
  try {
    processFile(file);
  } catch (err) {
    errors.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), error: err.message });
  }
}

// Report
console.log('\n' + '='.repeat(60));
console.log(`CHANGES: ${changes.length} files modified`);
console.log(`SKIPPED: ${skipped.length} files`);
console.log(`ERRORS:  ${errors.length} files`);

console.log('\n--- MODIFIED FILES ---');
for (const c of changes) {
  console.log(`  ${c.isServiceRole ? '[SERVICE]' : '[ANON]  '} ${c.file}`);
  for (const ch of c.changes) {
    console.log(`    - ${ch}`);
  }
}

if (skipped.length > 0) {
  console.log('\n--- SKIPPED FILES ---');
  for (const s of skipped) {
    console.log(`  ${s.file}: ${s.reason}`);
  }
}

if (errors.length > 0) {
  console.log('\n--- ERRORS ---');
  for (const e of errors) {
    console.log(`  ${e.file}: ${e.error}`);
  }
}

// Write report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    modified: changes.length,
    skipped: skipped.length,
    errors: errors.length,
    serviceRole: changes.filter(c => c.isServiceRole).length,
    anonKey: changes.filter(c => !c.isServiceRole).length,
  },
  changes,
  skipped,
  errors,
};

fs.writeFileSync(
  path.join(ROOT, 'audit-results', 'phase2-refactor-report.json'),
  JSON.stringify(report, null, 2),
  'utf-8'
);
console.log('\nReport saved to audit-results/phase2-refactor-report.json');
