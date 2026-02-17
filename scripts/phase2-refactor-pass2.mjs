/**
 * Phase 2 Pass 2: Handle remaining patterns not caught by pass 1
 *
 * Patterns:
 * A: const getSupabase = () => createClient(url, key)     → const getSupabase = createAdminClient
 * B: function getSupabase() { return createClient(url,key) } → function getSupabase() { return createAdminClient() }
 * C: supabaseClient || createClient(url, key)              → supabaseClient || createAdminClient()
 * D: Variable-based (sitemap, useSiteSettings)             → direct import
 * E: Files importing createClient but not using it         → remove import
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const changes = [];
const errors = [];

function processFile(filePath, strategy) {
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  const fileChanges = [];

  try {
    if (strategy === 'arrow_factory') {
      // Pattern A: const getSupabase = () => createClient(\n  url,\n  key\n);
      // Replace the arrow function with a reference to createAdminClient
      const arrowRegex = /const\s+(\w+)\s*=\s*\(\)\s*=>\s*createClient\(\s*\n?\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!?\s*,\s*\n?\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!?\s*\n?\s*\);?/g;
      const match = arrowRegex.exec(content);
      if (match) {
        const funcName = match[1];
        content = content.replace(match[0], `const ${funcName} = createAdminClient;`);
        fileChanges.push(`replaced arrow factory ${funcName} with createAdminClient reference`);
      } else {
        errors.push({ file: relPath, error: 'arrow_factory pattern not found' });
        return;
      }

      // Replace import
      content = replaceImport(content, fileChanges);
      // Add createAdminClient import
      content = addAdminImport(content, fileChanges);
      // Remove unused Database import
      content = removeUnusedDatabase(content, fileChanges);
    }

    else if (strategy === 'named_function') {
      // Pattern B: function getSupabase/getSupabaseClient() { ... return createClient(...) }
      // Replace body to use createAdminClient
      const funcRegex = /function\s+(\w+)\(\)[^{]*\{[\s\S]*?return\s+createClient\([\s\S]*?\);\s*\}/;
      const match = funcRegex.exec(content);
      if (match) {
        const funcName = match[1];
        // Get the return type annotation if any
        const sigRegex = new RegExp(`function\\s+${funcName}\\(\\)([^{]*?)\\{`);
        const sigMatch = sigRegex.exec(content);
        const returnType = sigMatch ? sigMatch[1].trim() : '';
        const returnTypeStr = returnType ? `${returnType} ` : ' ';

        content = content.replace(match[0], `function ${funcName}()${returnTypeStr}{\n  return createAdminClient();\n}`);
        fileChanges.push(`replaced ${funcName} body with createAdminClient()`);
      } else {
        errors.push({ file: relPath, error: 'named_function pattern not found' });
        return;
      }

      content = replaceImport(content, fileChanges);
      content = addAdminImport(content, fileChanges);
      content = removeUnusedDatabase(content, fileChanges);
    }

    else if (strategy === 'optional_client') {
      // Pattern C: supabaseClient || createClient(url, key)
      const optRegex = /createClient\(\s*\n?\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!?\s*,\s*\n?\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!?\s*\n?\s*\)/g;
      let matchCount = 0;
      content = content.replace(optRegex, () => {
        matchCount++;
        return 'createAdminClient()';
      });
      if (matchCount > 0) {
        fileChanges.push(`replaced ${matchCount} inline createClient calls with createAdminClient()`);
      }
      content = replaceImport(content, fileChanges);
      content = addAdminImport(content, fileChanges);
      content = removeUnusedDatabase(content, fileChanges);
    }

    else if (strategy === 'sitemap') {
      // Special: sitemap has variable-based key selection
      // Replace the whole pattern with createAdminClient
      content = content.replace(
        /const supabaseUrl = process\.env\.NEXT_PUBLIC_SUPABASE_URL!?\s*\n\s*const supabaseKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\| process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY!?\s*\n/,
        ''
      );
      // Replace createClient(supabaseUrl, supabaseKey) with createAdminClient()
      content = content.replace(/createClient\(\s*supabaseUrl\s*,\s*supabaseKey\s*\)/g, 'createAdminClient()');
      fileChanges.push('replaced variable-based createClient with createAdminClient()');
      content = replaceImport(content, fileChanges);
      content = addAdminImport(content, fileChanges);
      content = removeUnusedDatabase(content, fileChanges);
    }

    else if (strategy === 'anon_variable') {
      // useSiteSettings: variable-based anon key
      content = content.replace(
        /const supabaseUrl = process\.env\.NEXT_PUBLIC_SUPABASE_URL!?\s*;?\s*\n\s*const supabaseAnonKey = process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY!?\s*;?\s*\n/,
        ''
      );
      // Replace createClient(\n  supabaseUrl, supabaseAnonKey)
      content = content.replace(/createClient\(\s*\n?\s*supabaseUrl\s*,\s*supabaseAnonKey\s*\)/g, 'getSupabaseClient()');
      // Also handle single-line variant
      content = content.replace(/createClient\(\s*supabaseUrl\s*,\s*supabaseAnonKey\s*\)/g, 'getSupabaseClient()');
      fileChanges.push('replaced variable-based anon createClient with getSupabaseClient()');
      content = replaceImport(content, fileChanges);
      // Add client import
      if (!content.includes("from '@/lib/supabase/client'")) {
        const lastImportIdx = content.lastIndexOf('\nimport ');
        const lineEnd = content.indexOf('\n', lastImportIdx + 1);
        content = content.slice(0, lineEnd + 1) + "import { getSupabaseClient } from '@/lib/supabase/client';\n" + content.slice(lineEnd + 1);
        fileChanges.push('added getSupabaseClient import');
      }
      content = removeUnusedDatabase(content, fileChanges);
    }

    else if (strategy === 'remove_import_only') {
      // File imports createClient but doesn't create any client
      content = replaceImport(content, fileChanges);
      content = removeUnusedDatabase(content, fileChanges);
    }

    // Clean up blank lines
    content = content.replace(/\n{4,}/g, '\n\n\n');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8');
      changes.push({ file: relPath, changes: fileChanges });
    }
  } catch (err) {
    errors.push({ file: relPath, error: err.message });
  }
}

function replaceImport(content, fileChanges) {
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@supabase\/supabase-js['"];?\s*\n?/;
  const match = content.match(importRegex);
  if (match) {
    const imports = match[1].split(',').map(s => s.trim()).filter(Boolean);
    const otherImports = imports.filter(i => i !== 'createClient');
    if (otherImports.length > 0) {
      content = content.replace(match[0], `import { ${otherImports.join(', ')} } from '@supabase/supabase-js';\n`);
      fileChanges.push(`kept @supabase/supabase-js for: ${otherImports.join(', ')}`);
    } else {
      content = content.replace(match[0], '');
      fileChanges.push('removed @supabase/supabase-js import');
    }
  }
  return content;
}

function addAdminImport(content, fileChanges) {
  if (content.includes("from '@/lib/supabase/admin'")) return content;
  const lastImportIdx = content.lastIndexOf('\nimport ');
  if (lastImportIdx !== -1) {
    const lineEnd = content.indexOf('\n', lastImportIdx + 1);
    content = content.slice(0, lineEnd + 1) + "import { createAdminClient } from '@/lib/supabase/admin';\n" + content.slice(lineEnd + 1);
    fileChanges.push('added createAdminClient import');
  }
  return content;
}

function removeUnusedDatabase(content, fileChanges) {
  const dbImportRegex = /import\s*\{\s*Database\s*\}\s*from\s*['"]@\/lib\/supabase\/database\.types['"];?\s*\n?/;
  const match = content.match(dbImportRegex);
  if (match) {
    const withoutImport = content.replace(match[0], '');
    const refs = (withoutImport.match(/\bDatabase\b/g) || []).length;
    if (refs === 0) {
      content = content.replace(match[0], '');
      fileChanges.push('removed unused Database import');
    }
  }
  return content;
}

// ============================================================
// FILE LISTS
// ============================================================

const arrowFactoryFiles = [
  'app/api/cron/coach-reminders-1h/route.ts',
  'app/api/cron/compute-insights/route.ts',
  'app/api/cron/discovery-followup/route.ts',
  'app/api/cron/enrollment-lifecycle/route.ts',
  'app/api/cron/monthly-payouts/route.ts',
  'app/api/cron/re-enrollment-nudge/route.ts',
  'app/api/whatsapp/process/route.ts',
  'app/api/whatsapp/send/route.ts',
  'app/api/whatsapp/webhook/route.ts',
  'app/api/discovery-call/pending/route.ts',
  'app/api/discovery-call/[id]/questionnaire/route.ts',
  'app/api/discovery-call/[id]/send-payment-link/route.ts',
  'app/api/jobs/process-session/route.ts',
  'app/api/jobs/recall-reconciliation/route.ts',
  'app/api/jobs/enrollment-complete/route.ts',
  'app/api/coupons/calculate/route.ts',
  'app/api/coupons/validate/route.ts',
  'app/api/certificate/send/route.ts',
  'app/api/chat/route.ts',
  'app/api/assessment/analyze/route.ts',
  'lib/completion/complete-season.ts',
  'lib/tasks/generate-daily-tasks.ts',
  'lib/whatsapp/handlers/escalate.ts',
  'lib/auth-options.ts',
];

const namedFunctionFiles = [
  'app/api/sessions/route.ts',
  'app/api/sessions/missed/route.ts',
  'lib/scheduling/orchestrator.ts',
  'lib/scheduling/session-manager.ts',
  'lib/scheduling/config-provider.ts',
  'lib/scheduling/manual-queue.ts',
  'lib/scheduling/notification-manager.ts',
  'lib/scheduling/retry-queue.ts',
  'lib/scheduling/coach-availability-handler.ts',
];

const optionalClientFiles = [
  'lib/plan-generation/generate-learning-plan.ts',
  'lib/scheduling/enrollment-scheduler.ts',
  'lib/scheduling/config.ts',
];

const removeImportOnlyFiles = [
  'app/api/admin/payouts/route.ts',
  'app/api/communication/send/route.ts',
  'app/api/discovery-call/assign/route.ts',
  'app/api/discovery-call/[id]/send-followup/route.ts',
  'app/api/enrollment/calculate-revenue/route.ts',
  'app/api/leads/hot-alert/route.ts',
  'app/api/payouts/process/route.ts',
  'lib/referral.ts',
  'lib/scheduling/smart-slot-finder.ts',
];

// ============================================================
// MAIN
// ============================================================

console.log('Phase 2 Pass 2: Handle remaining createClient patterns');
console.log('='.repeat(60));

for (const f of arrowFactoryFiles) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) processFile(p, 'arrow_factory');
  else console.log(`  SKIP (not found): ${f}`);
}

for (const f of namedFunctionFiles) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) processFile(p, 'named_function');
  else console.log(`  SKIP (not found): ${f}`);
}

for (const f of optionalClientFiles) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) processFile(p, 'optional_client');
  else console.log(`  SKIP (not found): ${f}`);
}

// Sitemap special case
const sitemapPath = path.join(ROOT, 'app/sitemap.ts');
if (fs.existsSync(sitemapPath)) processFile(sitemapPath, 'sitemap');

// useSiteSettings special case
const siteSettingsPath = path.join(ROOT, 'lib/hooks/useSiteSettings.ts');
if (fs.existsSync(siteSettingsPath)) processFile(siteSettingsPath, 'anon_variable');

for (const f of removeImportOnlyFiles) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) processFile(p, 'remove_import_only');
  else console.log(`  SKIP (not found): ${f}`);
}

// Report
console.log('\n' + '='.repeat(60));
console.log(`CHANGES: ${changes.length} files modified`);
console.log(`ERRORS:  ${errors.length} files`);

for (const c of changes) {
  console.log(`  ${c.file}`);
  for (const ch of c.changes) {
    console.log(`    - ${ch}`);
  }
}

if (errors.length > 0) {
  console.log('\n--- ERRORS ---');
  for (const e of errors) {
    console.log(`  ${e.file}: ${e.error}`);
  }
}
