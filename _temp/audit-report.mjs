// Schema audit report generator — uses table-stats output + database.types.ts cross-ref
import fs from 'fs';

// Parse the table-stats output (copy-pasted from supabase inspect)
const rawStats = fs.readFileSync('_temp/table-stats-raw.txt', 'utf8');

// Parse table stats
const tables = [];
for (const line of rawStats.split('\n')) {
  const match = line.match(/public\.(\S+)\s+\|\s+(\S+ \S+)\s+\|\s+(\S+ \S+)\s+\|\s+(\S+ \S+)\s+\|\s+(\d+)\s+\|\s+(\d+)/);
  if (match) {
    tables.push({
      name: match[1],
      tableSize: match[2],
      indexSize: match[3],
      totalSize: match[4],
      rowCount: parseInt(match[5]),
      seqScans: parseInt(match[6]),
    });
  }
}

console.log(`Parsed ${tables.length} tables from stats`);

// Parse database.types.ts for table names
const typesFile = fs.readFileSync('lib/database.types.ts', 'utf8').replace(/\r\n/g, '\n');

// Extract table names from Tables section
const tablesInTypes = new Set();
const tableMatches = typesFile.matchAll(/^\s{6}(\w+):\s*\{\s*$/gm);
// Better: look for Row: { pattern
const rowMatches = typesFile.matchAll(/^\s{6}(\w+):\s*\{[\s\S]*?Row:\s*\{/gm);

// Extract from the public.Tables: { ... } section (skip graphql_public)
const publicSection = typesFile.match(/^\s{2}public:\s*\{[\s\S]*?Tables:\s*\{([\s\S]*?)Views:\s*\{/m);
const tablesSection = publicSection;
if (tablesSection) {
  const tableBlockMatches = tablesSection[1].matchAll(/^\s{6}(\w+):\s*\{/gm);
  for (const m of tableBlockMatches) {
    tablesInTypes.add(m[1]);
  }
}

// Also extract from Views section (public schema, not graphql_public)
// Find the Views section after the public Tables section
const publicBlock = typesFile.match(/^\s{2}public:\s*\{([\s\S]*?)^\s{2}\w+:\s*\{/m);
const viewsMatch = publicBlock ? publicBlock[1].match(/Views:\s*\{([\s\S]*?)Functions:\s*\{/) : null;
const viewsSection = viewsMatch;
const viewsInTypes = new Set();
if (viewsSection) {
  const viewBlockMatches = viewsSection[1].matchAll(/^\s{6}(\w+):\s*\{/gm);
  for (const m of viewBlockMatches) {
    viewsInTypes.add(m[1]);
  }
}

console.log(`Found ${tablesInTypes.size} tables in TypeScript types`);
console.log(`Found ${viewsInTypes.size} views in TypeScript types`);

// ===== Analysis =====

// 1. Empty tables
const emptyTables = tables.filter(t => t.rowCount === 0);

// 2. Similar names (fuzzy match)
function similarity(a, b) {
  // Simple: check if one is plural of other, or has _deprecated, or very similar
  if (a + 's' === b || b + 's' === a) return { type: 'plural', score: 0.95 };
  if (a + 'es' === b || b + 'es' === a) return { type: 'plural', score: 0.95 };
  if (a.replace(/_/g, '') === b.replace(/_/g, '')) return { type: 'underscore_variant', score: 0.9 };

  // Check prefix similarity
  const words_a = a.split('_');
  const words_b = b.split('_');
  const common = words_a.filter(w => words_b.includes(w));
  const score = common.length / Math.max(words_a.length, words_b.length);
  if (score >= 0.6) return { type: 'word_overlap', score, commonWords: common };
  return null;
}

const similarPairs = [];
for (let i = 0; i < tables.length; i++) {
  for (let j = i + 1; j < tables.length; j++) {
    const sim = similarity(tables[i].name, tables[j].name);
    if (sim && sim.score >= 0.6) {
      similarPairs.push({
        a: tables[i].name,
        b: tables[j].name,
        rowsA: tables[i].rowCount,
        rowsB: tables[j].rowCount,
        ...sim,
      });
    }
  }
}
similarPairs.sort((a, b) => b.score - a.score);

// 3. Tables missing from TypeScript types
const dbTableNames = new Set(tables.map(t => t.name));
const missingFromTypes = tables.filter(t => !tablesInTypes.has(t.name) && !viewsInTypes.has(t.name));
const inTypesNotInDB = [...tablesInTypes].filter(t => !dbTableNames.has(t));

// 4. Deprecated/backup tables
const deprecated = tables.filter(t =>
  t.name.includes('deprecated') ||
  t.name.includes('backup') ||
  t.name.includes('_old') ||
  t.name.match(/\d{8}$/) // date suffix like _20260117
);

// 5. Group by category
const report = [];

report.push('# Supabase Schema Audit Report');
report.push(`\nGenerated: ${new Date().toISOString()}`);
report.push(`\nTotal tables: **${tables.length}**`);
report.push(`Tables in TypeScript types: **${tablesInTypes.size}**`);
report.push(`Empty tables (0 rows): **${emptyTables.length}**`);

// --- Deprecated ---
report.push('\n## 1. Deprecated / Backup Tables');
if (deprecated.length === 0) {
  report.push('\nNone found with `deprecated`, `backup`, `_old`, or date-suffix naming.');
} else {
  report.push('\n| Table | Rows | Size | Recommendation |');
  report.push('|-------|------|------|----------------|');
  for (const t of deprecated) {
    report.push(`| \`${t.name}\` | ${t.rowCount} | ${t.totalSize} | DROP after verifying data is backed up |`);
  }
}

// --- Similar Names ---
report.push('\n## 2. Tables with Similar Names (Potential Duplicates)');
report.push('\n| Table A | Rows | Table B | Rows | Match Type | Score |');
report.push('|---------|------|---------|------|------------|-------|');
for (const p of similarPairs) {
  report.push(`| \`${p.a}\` | ${p.rowsA} | \`${p.b}\` | ${p.rowsB} | ${p.type} | ${p.score.toFixed(2)} |`);
}

// --- Empty Tables ---
report.push('\n## 3. Empty Tables (0 Rows)');
report.push('\nThese tables have been created but never populated, or were emptied.');
report.push('\n| Table | Size (incl index) | Seq Scans | Recommendation |');
report.push('|-------|-------------------|-----------|----------------|');
for (const t of emptyTables) {
  const scanNote = t.seqScans > 100 ? 'Actively queried despite empty' : t.seqScans > 10 ? 'Some queries' : 'Rarely queried';
  const rec = t.seqScans > 50
    ? 'KEEP — actively queried, may be populated soon'
    : 'Review — possibly unused, candidate for DROP';
  report.push(`| \`${t.name}\` | ${t.totalSize} | ${t.seqScans} (${scanNote}) | ${rec} |`);
}

// --- Missing from TypeScript ---
report.push('\n## 4. Tables Missing from TypeScript Types');
report.push('\nThese tables exist in the DB but are NOT in `lib/database.types.ts`.');
report.push('They cannot be used with typed Supabase client queries.\n');
if (missingFromTypes.length === 0) {
  report.push('All tables have TypeScript types.');
} else {
  report.push('| Table | Rows | Size | Notes |');
  report.push('|-------|------|------|-------|');
  for (const t of missingFromTypes) {
    const note = t.rowCount === 0 ? 'Empty — may be new migration not yet typed' : `${t.rowCount} rows — needs types`;
    report.push(`| \`${t.name}\` | ${t.rowCount} | ${t.totalSize} | ${note} |`);
  }
}

if (inTypesNotInDB.length > 0) {
  report.push('\n### Tables in TypeScript Types but NOT in Database');
  report.push('\nThese may be views or tables that were dropped without updating types.\n');
  for (const t of inTypesNotInDB) {
    report.push(`- \`${t}\``);
  }
}

// --- Semantic Groups ---
report.push('\n## 5. Semantic Grouping — Potential Overlaps');

// Group by prefix
const prefixGroups = {};
for (const t of tables) {
  const prefix = t.name.split('_').slice(0, 2).join('_');
  if (!prefixGroups[prefix]) prefixGroups[prefix] = [];
  prefixGroups[prefix].push(t);
}

const interestingGroups = Object.entries(prefixGroups)
  .filter(([_, group]) => group.length >= 3)
  .sort((a, b) => b[1].length - a[1].length);

for (const [prefix, group] of interestingGroups) {
  report.push(`\n### \`${prefix}_*\` (${group.length} tables)`);
  report.push('| Table | Rows | Size |');
  report.push('|-------|------|------|');
  for (const t of group) {
    report.push(`| \`${t.name}\` | ${t.rowCount} | ${t.totalSize} |`);
  }
}

// --- Specific duplicate / overlap analysis ---
report.push('\n## 6. Confirmed Duplicates & Overlapping Schemas');
report.push('\nManual analysis of similar-named tables:\n');

// Check specific known patterns
const knownOverlaps = [
  { a: 'coupon_uses', b: 'coupon_usages', note: 'Both track coupon usage. Likely one is deprecated.' },
  { a: 'coach_availability', b: 'coach_availability_slots', note: 'Both store coach availability. `coach_availability_slots` may be the v2.' },
  { a: 'coach_schedule_rules', b: 'system_schedule_defaults', note: 'Both define scheduling rules. May overlap in purpose.' },
  { a: 'session_notes', b: 'session_activity_log', note: 'Both store session-level coach notes. Different granularity.' },
  { a: 'book_reads', b: 'video_watch_sessions', note: 'Both track content consumption. Different content types (OK).' },
  { a: 'termination_logs', b: 'enrollment_terminations', note: 'Both track enrollment terminations. Likely overlap.' },
  { a: 'reading_skills', b: 'el_skills', note: 'Both define skills. `reading_skills` may be legacy, `el_skills` is the elearning system.' },
  { a: 'reading_skills', b: 'skill_tags_master', note: '`reading_skills` vs `skill_tags_master` — both define skill taxonomies.' },
  { a: 'reading_skills', b: 'skill_categories', note: '`reading_skills` (17 rows) may overlap with `skill_categories` (10 rows) — different taxonomy levels.' },
  { a: 'communication_logs', b: 'communication_analytics', note: 'Both track communication. logs=delivery, analytics=engagement.' },
  { a: 'communication_queue', b: 'communication_logs', note: 'Queue (pending) vs logs (sent). Complementary if used correctly.' },
  { a: 'parent_communications', b: 'communication_logs', note: '`parent_communications` (0 rows, 800 scans) vs `communication_logs` (22 rows). May be redundant.' },
  { a: 'child_rag_profiles', b: 'child_intelligence_profiles', note: 'Both store child AI profiles. `child_rag_profiles` (0 rows) may be deprecated in favor of `child_intelligence_profiles` (42 rows).' },
  { a: 'coach_scores', b: 'coach_payouts', note: 'Both empty. `coach_scores` may be unused. `coach_payouts` likely pending first payout cycle.' },
  { a: 'coach_earnings', b: 'coach_payouts', note: 'Both empty. `coach_earnings` is likely a view or deprecated.' },
];

for (const o of knownOverlaps) {
  const tA = tables.find(t => t.name === o.a);
  const tB = tables.find(t => t.name === o.b);
  if (tA && tB) {
    report.push(`- **\`${o.a}\`** (${tA.rowCount} rows) vs **\`${o.b}\`** (${tB.rowCount} rows): ${o.note}`);
  }
}

// --- Recommendations ---
report.push('\n## 7. Recommended Actions');
report.push('\n### High Priority (Clear cleanup)');
report.push('');
report.push('| Action | Table | Reason |');
report.push('|--------|-------|--------|');
report.push('| **DROP** | `phone_backup_20260117` | Date-suffixed backup table, 17 rows |');
report.push('| **MERGE or DROP** | `coupon_uses` + `coupon_usages` | Both empty, duplicate purpose |');
report.push('| **DROP** | `child_rag_profiles` | 0 rows, 1.2MB index. Superseded by `child_intelligence_profiles` |');
report.push('| **DROP** | `termination_logs` | 0 rows, 295 scans. Overlaps with `enrollment_terminations` |');
report.push('| **REVIEW** | `reading_skills` | 17 rows. May overlap with `el_skills` (79 rows) + `skill_categories` (10 rows) |');
report.push('| **REVIEW** | `parent_communications` | 0 rows, 800 scans. May be superseded by `communication_logs` |');

report.push('\n### Medium Priority (Review before acting)');
report.push('');
report.push('| Action | Table | Reason |');
report.push('|--------|-------|--------|');

const medPriority = emptyTables.filter(t =>
  t.seqScans < 50 &&
  !['phone_backup_20260117', 'child_rag_profiles', 'coupon_uses', 'coupon_usages',
    'termination_logs', 'parent_communications'].includes(t.name)
);

for (const t of medPriority) {
  report.push(`| REVIEW | \`${t.name}\` | 0 rows, ${t.seqScans} scans, ${t.totalSize} |`);
}

report.push('\n### Low Priority (Keep — actively used or expected)');

const activeTables = tables.filter(t => t.rowCount > 0 && t.seqScans > 100);
report.push(`\n${activeTables.length} tables are actively used (>0 rows, >100 seq scans). No action needed.`);

report.push('\n### TypeScript Types Regeneration');
report.push('\nRun `npx supabase gen types typescript --linked > lib/database.types.ts` after applying all pending migrations to:');
report.push('- Add `skill_categories` table types');
report.push('- Add any other new tables from recent migrations');

// Write report
const reportText = report.join('\n');
fs.writeFileSync('_temp/schema-audit-report.md', reportText);
console.log(`\nReport written to _temp/schema-audit-report.md (${reportText.length} chars)`);
