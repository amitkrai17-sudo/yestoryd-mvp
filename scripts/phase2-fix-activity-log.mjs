#!/usr/bin/env node
/**
 * Phase 2 Fix: activity_log inserts
 *
 * Problem: All activity_log inserts use `details:` instead of `metadata:`
 * and most are missing the required `user_type` field.
 *
 * Fix: Replace `details:` → `metadata:` and add `user_type` where missing.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const files = await glob('**/*.{ts,tsx}', {
  cwd: 'C:/yestoryd-mvp',
  ignore: ['node_modules/**', '.next/**', 'scripts/**'],
  absolute: true,
});

let fixedCount = 0;
const fixes = [];

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Find activity_log insert blocks
  // Pattern: .from('activity_log').insert({...})
  const regex = /\.from\('activity_log'\)\.insert\(\{([\s\S]*?)\}\)/g;
  let match;
  let modified = false;

  while ((match = regex.exec(content)) !== null) {
    const block = match[1];
    let newBlock = block;

    // Fix 1: Replace `details:` with `metadata:`
    if (newBlock.includes('details:') && !newBlock.includes('metadata:')) {
      newBlock = newBlock.replace(/\bdetails:/g, 'metadata:');
      modified = true;
    }

    // Fix 2: Add user_type if missing
    if (!newBlock.includes('user_type:')) {
      // Determine user_type from context
      let userType = "'admin'";
      if (newBlock.includes("'engage@yestoryd.com'")) {
        userType = "'system'";
      } else if (filePath.includes('/cron/')) {
        userType = "'system'";
      } else if (filePath.includes('/coach/')) {
        userType = "'coach'";
      }

      // Insert user_type after user_email line
      newBlock = newBlock.replace(
        /(user_email:\s*[^,]+,)/,
        `$1\n      user_type: ${userType},`
      );
      modified = true;
    }

    // Fix 3: Fix auth.email that might be undefined (add || 'unknown')
    // Only if it's `auth.email,` without a fallback
    if (newBlock.match(/user_email:\s*auth\.email\s*,/) && !newBlock.includes("|| 'unknown'")) {
      newBlock = newBlock.replace(
        /user_email:\s*auth\.email\s*,/,
        "user_email: auth.email || 'unknown',"
      );
      modified = true;
    }

    if (modified) {
      content = content.replace(match[1], newBlock);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    fixedCount++;
    fixes.push(path.relative('C:/yestoryd-mvp', filePath));
    console.log(`Fixed: ${path.relative('C:/yestoryd-mvp', filePath)}`);
  }
}

console.log(`\n✅ Fixed ${fixedCount} files`);
console.log(fixes.join('\n'));
