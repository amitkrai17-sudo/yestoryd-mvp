#!/usr/bin/env node

import fs from 'fs';
import textToSpeech from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get credentials
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

if (!privateKey || !serviceAccountEmail) {
  console.error('❌ Missing Google Cloud credentials in .env.local');
  process.exit(1);
}

const credentials = {
  client_email: serviceAccountEmail,
  private_key: privateKey,
};

const client = new textToSpeech.TextToSpeechClient({ credentials });

// All Indian English voices to test
const voices = [
  { name: 'en-IN-Neural2-A', label: 'Neural2-A (Female Clear)', gender: 'FEMALE' },
  { name: 'en-IN-Neural2-B', label: 'Neural2-B (Male Deep)', gender: 'MALE' },
  { name: 'en-IN-Neural2-C', label: 'Neural2-C (Male Light)', gender: 'MALE' },
  { name: 'en-IN-Neural2-D', label: 'Neural2-D (Female Warm)', gender: 'FEMALE' },
  { name: 'en-IN-Wavenet-A', label: 'Wavenet-A (Female)', gender: 'FEMALE' },
  { name: 'en-IN-Wavenet-B', label: 'Wavenet-B (Male)', gender: 'MALE' },
  { name: 'en-IN-Wavenet-C', label: 'Wavenet-C (Male)', gender: 'MALE' },
  { name: 'en-IN-Wavenet-D', label: 'Wavenet-D (Female Gentle)', gender: 'FEMALE' },
  { name: 'en-IN-Standard-A', label: 'Standard-A (Female)', gender: 'FEMALE' },
  { name: 'en-IN-Standard-B', label: 'Standard-B (Male)', gender: 'MALE' },
  { name: 'en-IN-Standard-C', label: 'Standard-C (Male)', gender: 'MALE' },
  { name: 'en-IN-Standard-D', label: 'Standard-D (Female)', gender: 'FEMALE' },
];

// Test text representative of Mini Challenge content
const testTexts = {
  question: "Which word rhymes with cat? Is it dog, bat, or sun?",
  feedback: "Great job! You got the answer right. The word bat rhymes with cat because they both end with the at sound. Can you hear it? Let's try another one!",
  encouragement: "You're doing amazing! Keep going!",
};

async function generateSample(voice, text, textType) {
  try {
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: 'en-IN',
        name: voice.name,
        ssmlGender: voice.gender,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.9,
        pitch: 0,
      },
    });

    const filename = `voice-samples/${voice.name}-${textType}.mp3`;
    fs.writeFileSync(filename, response.audioContent);
    return true;
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return false;
  }
}

async function generateAllSamples() {
  console.log('🎤 TTS Voice Comparison Script\n');
  console.log('Generating voice samples for all Indian English voices...\n');

  // Create output directory
  if (!fs.existsSync('voice-samples')) {
    fs.mkdirSync('voice-samples');
    console.log('📁 Created voice-samples/ directory\n');
  }

  let successCount = 0;
  let failCount = 0;

  for (const voice of voices) {
    console.log(`\n🔊 ${voice.label} (${voice.name})`);

    // Generate question sample
    process.stdout.write('   📝 Question... ');
    const q = await generateSample(voice, testTexts.question, 'question');
    if (q) {
      console.log('✅');
      successCount++;
    } else {
      failCount++;
    }

    // Generate feedback sample
    process.stdout.write('   💬 Feedback... ');
    const f = await generateSample(voice, testTexts.feedback, 'feedback');
    if (f) {
      console.log('✅');
      successCount++;
    } else {
      failCount++;
    }

    // Generate encouragement sample
    process.stdout.write('   ⭐ Encouragement... ');
    const e = await generateSample(voice, testTexts.encouragement, 'encouragement');
    if (e) {
      console.log('✅');
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Success: ${successCount} samples`);
  console.log(`❌ Failed: ${failCount} samples`);
  console.log(`\n📁 All samples saved in: voice-samples/\n`);

  // Create README for the samples
  const readmeContent = `# TTS Voice Samples

Generated on: ${new Date().toISOString()}

## How to Listen

Open the MP3 files in this folder to compare voices.

## File Naming

\`{voice-name}-{type}.mp3\`

- **question**: Quiz question sample
- **feedback**: Answer feedback sample
- **encouragement**: Short encouragement sample

## Voice Categories

### Neural2 (Premium Quality)
- **en-IN-Neural2-A** - Female, Clear
- **en-IN-Neural2-B** - Male, Deep
- **en-IN-Neural2-C** - Male, Light
- **en-IN-Neural2-D** - Female, Warm

### Wavenet (High Quality)
- **en-IN-Wavenet-A** - Female
- **en-IN-Wavenet-B** - Male
- **en-IN-Wavenet-C** - Male
- **en-IN-Wavenet-D** - Female, Gentle

### Standard (Basic Quality)
- **en-IN-Standard-A** - Female
- **en-IN-Standard-B** - Male
- **en-IN-Standard-C** - Male
- **en-IN-Standard-D** - Female

## Recommendation

For educational content with children:
- **Neural2-D** - Warmest female voice
- **Neural2-A** - Clearest female voice
- **Wavenet-D** - Gentle, kid-friendly

## Test Text Used

**Question:**
"${testTexts.question}"

**Feedback:**
"${testTexts.feedback}"

**Encouragement:**
"${testTexts.encouragement}"
`;

  fs.writeFileSync('voice-samples/README.md', readmeContent);
  console.log('📄 Created README.md in voice-samples/\n');

  // Create HTML player for easy comparison
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TTS Voice Comparison</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; }
    .voice-section {
      background: white;
      padding: 20px;
      margin: 15px 0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .voice-name {
      font-size: 18px;
      font-weight: bold;
      color: #ff0099;
      margin-bottom: 10px;
    }
    .sample {
      margin: 10px 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sample-label {
      font-weight: 500;
      min-width: 120px;
      color: #666;
    }
    audio {
      flex: 1;
    }
    .category {
      background: #ff0099;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>🎤 TTS Voice Comparison</h1>
  <p>Listen to all Indian English voices with Mini Challenge content.</p>

  <h2><span class="category">NEURAL2</span> Premium Quality</h2>
  ${voices
    .filter((v) => v.name.includes('Neural2'))
    .map(
      (v) => `
  <div class="voice-section">
    <div class="voice-name">${v.label}</div>
    <div class="sample">
      <span class="sample-label">📝 Question:</span>
      <audio controls src="${v.name}-question.mp3"></audio>
    </div>
    <div class="sample">
      <span class="sample-label">💬 Feedback:</span>
      <audio controls src="${v.name}-feedback.mp3"></audio>
    </div>
    <div class="sample">
      <span class="sample-label">⭐ Encouragement:</span>
      <audio controls src="${v.name}-encouragement.mp3"></audio>
    </div>
  </div>
  `
    )
    .join('')}

  <h2><span class="category">WAVENET</span> High Quality</h2>
  ${voices
    .filter((v) => v.name.includes('Wavenet'))
    .map(
      (v) => `
  <div class="voice-section">
    <div class="voice-name">${v.label}</div>
    <div class="sample">
      <span class="sample-label">📝 Question:</span>
      <audio controls src="${v.name}-question.mp3"></audio>
    </div>
    <div class="sample">
      <span class="sample-label">💬 Feedback:</span>
      <audio controls src="${v.name}-feedback.mp3"></audio>
    </div>
    <div class="sample">
      <span class="sample-label">⭐ Encouragement:</span>
      <audio controls src="${v.name}-encouragement.mp3"></audio>
    </div>
  </div>
  `
    )
    .join('')}

  <h2><span class="category">STANDARD</span> Basic Quality</h2>
  ${voices
    .filter((v) => v.name.includes('Standard'))
    .map(
      (v) => `
  <div class="voice-section">
    <div class="voice-name">${v.label}</div>
    <div class="sample">
      <span class="sample-label">📝 Question:</span>
      <audio controls src="${v.name}-question.mp3"></audio>
    </div>
    <div class="sample">
      <span class="sample-label">💬 Feedback:</span>
      <audio controls src="${v.name}-feedback.mp3"></audio>
    </div>
    <div class="sample">
      <span class="sample-label">⭐ Encouragement:</span>
      <audio controls src="${v.name}-encouragement.mp3"></audio>
    </div>
  </div>
  `
    )
    .join('')}
</body>
</html>`;

  fs.writeFileSync('voice-samples/compare.html', htmlContent);
  console.log('🌐 Created compare.html - open in browser for easy comparison!\n');

  console.log('🎧 Next steps:');
  console.log('   1. Open voice-samples/compare.html in your browser');
  console.log('   2. Or play individual MP3 files');
  console.log('   3. Choose your favorite voice');
  console.log('   4. Update lib/tts/google-tts.ts to use it\n');
}

generateAllSamples().catch(console.error);
