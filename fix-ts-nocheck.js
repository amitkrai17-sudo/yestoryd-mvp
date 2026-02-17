const fs = require('fs');
const path = require('path');

const filesToFix = [
  './app/api/payment/create/route.ts',
  './app/api/payment/validate-retry/route.ts',
  './app/api/payment/verify/route.ts',
  './app/api/payment/webhook/route.ts',
  './app/api/payouts/process/route.ts',
  './app/api/refund/initiate/route.ts',
  './app/api/webhooks/recall/route.ts',
  './app/api/products/route.ts',
  './app/api/sessions/confirm/route.ts',
  './app/api/sessions/complete/route.ts',
  './app/api/sessions/[id]/feedback/route.ts',
  './app/api/sessions/[id]/cancel-request/route.ts',
  './app/api/sessions/[id]/reschedule-request/route.ts',
  './app/api/sessions/change-request/[id]/approve/route.ts',
  './app/api/sessions/parent-checkin/route.ts',
];

for (const file of filesToFix) {
  const filePath = path.resolve(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // Remove @ts-nocheck
  content = content.replace(/^\/\/ @ts-nocheck\n/, '');
  content = content.replace(/^\/\/ @ts-nocheck\r\n/, '');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Fixed: ${file}`);
}

console.log('\nAll files processed. Now run: npx next build');
