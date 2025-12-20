// rebrand-to-rai.js
// Run: node rebrand-to-rai.js

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Yestoryd Rebrand: Vedant AI → rAI');
console.log('================================================\n');

// Files to update
const files = [
  'app/admin/coach-applications/page.tsx',
  'app/api/certificate/send/route.ts',
  'app/api/chat/route.ts',
  'app/api/coach-assessment/calculate-score/route.ts',
  'app/api/coach-assessment/chat/route.ts',
  'app/assessment/page.tsx',
  'app/assessment/results/[id]/page.tsx',
  'app/HomePageClient.tsx',
  'app/page.tsx',
  'app/parent/dashboard/page.tsx',
  'app/parent/login/page.tsx',
  'app/parent/support/page.tsx',
  'app/yestoryd-academy/assessment/page.tsx',
  'app/yestoryd-academy/page.tsx'
];

// Replacements (order matters - specific first)
const replacements = [
  // Image file rename
  ['vedant-mascot.png', 'rai-mascot.png'],
  
  // Specific phrases
  ['Vedant AI Feedback', 'rAI Analysis'],
  ['Vedant AI says', 'rAI says'],
  ["Vedant AI's", "rAI's"],
  ['Meet Vedant AI', 'Meet rAI'],
  ['Vedant AI analyzes', 'rAI analyzes'],
  ['Vedant AI listens', 'rAI listens'],
  ['Vedant AI pinpointed', 'rAI pinpointed'],
  ['Chat with Vedant', 'Chat with rAI'],
  ['with Vedant AI', 'with rAI'],
  ['Powered by Vedant AI', 'Powered by rAI'],
  ['via Vedant AI', 'via rAI'],
  ['from Vedant AI', 'from rAI'],
  ['to Vedant AI', 'to rAI'],
  
  // Variable names
  ['vedantScore', 'raiScore'],
  ['vedantAnalysis', 'raiAnalysis'],
  ['showVedantChat', 'showRaiChat'],
  ['startVedantConversation', 'startRaiConversation'],
  ['VEDANT_SYSTEM_PROMPT', 'RAI_SYSTEM_PROMPT'],
  
  // Object keys
  ['vedant:', 'rai:'],
  ['.vedant', '.rai'],
  
  // Alt text
  ['alt="Vedant', 'alt="rAI'],
  
  // System prompts
  ["I'm Vedant", "I'm rAI"],
  ['as Vedant', 'as rAI'],
  ['You are Vedant', 'You are rAI'],
  
  // Comments
  ['Vedant-powered', 'rAI-powered'],
  ['Gemini-powered Vedant', 'Gemini-powered rAI'],
  
  // Display text (do these last - more generic)
  ['Vedant AI', 'rAI'],
  ['Vedant:', 'rAI:'],
  ['Vedant,', 'rAI,'],
  ["'Vedant'", "'rAI'"],
  ['"Vedant"', '"rAI"'],
  
  // Tagline update
  ['Your Reading Coach', 'Your AI Reading Coach'],
];

let totalChanges = 0;

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    let fileChanges = 0;
    
    replacements.forEach(([oldText, newText]) => {
      const regex = new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = content.match(regex);
      if (matches) {
        fileChanges += matches.length;
        content = content.replace(regex, newText);
      }
    });
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${filePath} - ${fileChanges} changes`);
      totalChanges += fileChanges;
    } else {
      console.log(`⏭️  ${filePath} - No changes`);
    }
  } else {
    console.log(`❌ ${filePath} - Not found`);
  }
});

// Rename the image file
const oldImagePath = 'public/images/vedant-mascot.png';
const newImagePath = 'public/images/rai-mascot.png';

if (fs.existsSync(oldImagePath)) {
  fs.renameSync(oldImagePath, newImagePath);
  console.log(`\n✅ Renamed: vedant-mascot.png → rai-mascot.png`);
} else if (fs.existsSync(newImagePath)) {
  console.log(`\n⏭️  Image already renamed to rai-mascot.png`);
} else {
  console.log(`\n⚠️  Image not found at ${oldImagePath}`);
}

console.log('\n================================================');
console.log(`✨ Rebrand complete! Total changes: ${totalChanges}`);
console.log('\n📌 Next steps:');
console.log('   git add .');
console.log('   git commit -m "Rebrand: Vedant AI to rAI"');
console.log('   git push');
console.log('================================================\n');
