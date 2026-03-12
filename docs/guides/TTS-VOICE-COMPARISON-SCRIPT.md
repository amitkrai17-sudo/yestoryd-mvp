# TTS Voice Comparison Script - COMPLETE ✅

## Overview

Created a comprehensive script to generate audio samples for all 12 Indian English voices, making it easy to compare and choose the best voice for Mini Challenge.

---

## Files Created

### ✅ `scripts/test-tts-voices.mjs`
Main script that generates voice samples.

**Features:**
- Generates 3 sample types per voice (question, feedback, encouragement)
- Tests 12 voices: Neural2 (4), Wavenet (4), Standard (4)
- Creates 36 MP3 files total
- Generates interactive HTML player
- Creates README with voice descriptions
- Progress indicators and error handling

### ✅ `scripts/README-TTS-VOICES.md`
Comprehensive guide for using the script and choosing voices.

**Includes:**
- How to run the script
- Voice characteristics and recommendations
- Comparison tips
- Troubleshooting guide

### ✅ Updated `.gitignore`
Added `voice-samples/` to prevent committing generated audio files.

### ✅ Installed `dotenv`
Required dependency for loading environment variables in the script.

---

## How to Use

### 1. Run the Script

```bash
node scripts/test-tts-voices.mjs
```

### Expected Output:

```
🎤 TTS Voice Comparison Script

Generating voice samples for all Indian English voices...

📁 Created voice-samples/ directory

🔊 Neural2-A (Female Clear) (en-IN-Neural2-A)
   📝 Question... ✅
   💬 Feedback... ✅
   ⭐ Encouragement... ✅

🔊 Neural2-B (Male Deep) (en-IN-Neural2-B)
   📝 Question... ✅
   💬 Feedback... ✅
   ⭐ Encouragement... ✅

[... 10 more voices ...]

============================================================

✅ Success: 36 samples
❌ Failed: 0 samples

📁 All samples saved in: voice-samples/

📄 Created README.md in voice-samples/

🌐 Created compare.html - open in browser for easy comparison!

🎧 Next steps:
   1. Open voice-samples/compare.html in your browser
   2. Or play individual MP3 files
   3. Choose your favorite voice
   4. Update lib/tts/google-tts.ts to use it
```

### 2. Compare Voices

**Option A: HTML Player (Recommended)**
```bash
# Open in browser (Windows)
start voice-samples\compare.html

# Or navigate to the file and double-click it
```

The HTML player shows all voices organized by category with:
- Side-by-side comparison
- Play buttons for each sample type
- Color-coded categories (Neural2, Wavenet, Standard)

**Option B: Individual Files**
```bash
cd voice-samples

# Play specific samples (Windows PowerShell)
Start-Process en-IN-Neural2-A-question.mp3
Start-Process en-IN-Neural2-D-feedback.mp3
Start-Process en-IN-Wavenet-D-encouragement.mp3
```

---

## Output Structure

```
voice-samples/
├── compare.html                          ← Interactive HTML player
├── README.md                             ← Voice descriptions
│
├── en-IN-Neural2-A-question.mp3         ← Female Clear
├── en-IN-Neural2-A-feedback.mp3
├── en-IN-Neural2-A-encouragement.mp3
│
├── en-IN-Neural2-B-question.mp3         ← Male Deep
├── en-IN-Neural2-B-feedback.mp3
├── en-IN-Neural2-B-encouragement.mp3
│
├── en-IN-Neural2-C-question.mp3         ← Male Light
├── en-IN-Neural2-C-feedback.mp3
├── en-IN-Neural2-C-encouragement.mp3
│
├── en-IN-Neural2-D-question.mp3         ← Female Warm
├── en-IN-Neural2-D-feedback.mp3
├── en-IN-Neural2-D-encouragement.mp3
│
├── [8 more Wavenet voices...]
└── [12 more Standard voices...]
```

**Total:** 36 MP3 files + HTML player + README

---

## Test Text Used

### Question Sample (12 characters)
```
"Which word rhymes with cat? Is it dog, bat, or sun?"
```

### Feedback Sample (154 characters)
```
"Great job! You got the answer right. The word bat rhymes with cat
because they both end with the at sound. Can you hear it?
Let's try another one!"
```

### Encouragement Sample (35 characters)
```
"You're doing amazing! Keep going!"
```

**Why these texts?**
- Representative of actual Mini Challenge content
- Mix of questions, explanations, and encouragement
- Different lengths to test voice consistency
- Kid-friendly language and tone

---

## Voice Recommendations

### 🌟 Top Picks for Mini Challenge

#### For Young Children (Ages 4-7)

1. **en-IN-Neural2-D** ⭐ (Female Warm)
   - Warmest, most kid-friendly
   - Gentle and encouraging tone
   - **Recommended for feedback and encouragement**

2. **en-IN-Wavenet-D** (Female Gentle)
   - Soft and nurturing
   - Great for young learners
   - Good fallback option

3. **en-IN-Neural2-A** (Female Clear)
   - Clear and friendly
   - Professional but warm
   - **Good for questions**

#### For Older Children (Ages 8-12)

1. **en-IN-Neural2-A** ⭐ (Female Clear)
   - Most versatile
   - Professional and clear
   - **Best all-around choice**

2. **en-IN-Neural2-D** (Female Warm)
   - Still warm but mature enough
   - Friendly without being childish

3. **en-IN-Wavenet-A** (Female)
   - Natural sounding
   - Clear pronunciation

#### For All Ages (Safe Choice)

**en-IN-Neural2-A** (Female Clear)
- Works well for ages 4-12
- Clear without being cold
- Professional without being boring
- **Currently used in the app**

---

## Voice Categories Explained

### Neural2 (Premium Quality) - $16/million chars

**Technology:** Latest Neural TTS from Google
**Quality:** Highest available
**Naturalness:** Most human-like
**Pricing:** Same as others

| Voice | Gender | Best For |
|-------|--------|----------|
| Neural2-A | Female | All-purpose, questions |
| Neural2-B | Male | Older children |
| Neural2-C | Male | General use |
| Neural2-D | Female | Young children, feedback |

### Wavenet (High Quality) - $16/million chars

**Technology:** Previous generation Neural TTS
**Quality:** Very high
**Naturalness:** Natural sounding
**Pricing:** Same as Neural2

| Voice | Gender | Best For |
|-------|--------|----------|
| Wavenet-A | Female | General use |
| Wavenet-B | Male | Instructions |
| Wavenet-C | Male | Encouragement |
| Wavenet-D | Female | Young children |

### Standard (Basic Quality) - $4/million chars

**Technology:** Parametric TTS (older)
**Quality:** Basic
**Naturalness:** Robotic
**Pricing:** 75% cheaper but lower quality

**Recommendation:** Avoid unless budget is extremely tight. Neural2 and Wavenet sound significantly better for same price.

---

## Script Features

### ✅ Comprehensive Coverage
- 12 voices tested
- 3 sample types each
- 36 total samples

### ✅ User-Friendly Output
- Interactive HTML player
- Organized by category
- README with descriptions

### ✅ Robust Error Handling
- Continues if one voice fails
- Shows success/fail counts
- Detailed error messages

### ✅ Professional Output
- MP3 format (universal compatibility)
- 0.9x speaking rate (clearer for children)
- Consistent audio quality

### ✅ Easy Comparison
- Side-by-side playback
- Same test text for all voices
- Visual categorization

---

## Technical Details

### Dependencies Required
```json
{
  "@google-cloud/text-to-speech": "^5.x",
  "dotenv": "^16.x"
}
```

### Environment Variables
```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Audio Settings
```javascript
{
  audioEncoding: 'MP3',
  speakingRate: 0.9,  // 10% slower for clarity
  pitch: 0,           // Normal pitch
}
```

### API Endpoint
```
https://texttospeech.googleapis.com/v1/text:synthesize
```

---

## Choosing the Right Voice

### Considerations

1. **Target Age Group**
   - Younger children (4-7): Warmer, gentler voices
   - Older children (8-12): Clear, professional voices

2. **Content Type**
   - Questions: Clear, articulate voices
   - Feedback: Warm, encouraging voices
   - Instructions: Professional, authoritative voices

3. **Listening Fatigue**
   - Will users hear this voice 10+ times?
   - Choose a voice that doesn't become annoying

4. **Brand Alignment**
   - Does the voice match your brand personality?
   - Educational? Friendly? Professional?

5. **Device Testing**
   - Test on phone speakers (most common)
   - Test on tablets
   - Test on laptops/desktops

### Testing Process

1. **Generate samples** with this script
2. **Listen on multiple devices** (phone, tablet, laptop)
3. **Test with target users** (children and parents)
4. **Check listening fatigue** (play 10x in a row)
5. **Compare with competition** (other edu apps)
6. **Make final decision**

---

## How to Apply Your Choice

After selecting your preferred voice:

### Update TTS Utility

**File:** `lib/tts/google-tts.ts`

```typescript
// Update the fallback voice (line ~125)
export async function generateSpeech(options: TTSOptions): Promise<Buffer> {
  const client = createTTSClient();
  const voiceConfig = getVoiceConfig(options.age);

  const request = {
    input: { text: options.text },
    voice: {
      languageCode: 'en-IN',
      name: 'en-IN-Neural2-D', // ← Change this to your chosen voice
      ssmlGender: 'FEMALE' as const, // Or 'MALE'
    },
    audioConfig: {
      audioEncoding: 'MP3' as const,
      speakingRate: voiceConfig.speakingRate,
      pitch: voiceConfig.pitch,
    },
  };

  const [response] = await client.synthesizeSpeech(request);
  return Buffer.from(response.audioContent as Uint8Array);
}
```

### Test Your Change

```bash
# Start dev server
npm run dev

# Test TTS endpoint
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Great job! You got it right!","age":6}' \
  --output test-new-voice.mp3

# Play the audio
Start-Process test-new-voice.mp3

# Or test in Mini Challenge
# Navigate to /mini-challenge/{childId}
# Click "Listen" buttons
```

---

## Cost Impact

### Current Setup
- **Primary:** Gemini Pro TTS (Kore voice)
- **Fallback:** Neural2-A

### Cost
- Both same price: $16/million characters
- Changing fallback voice = no cost change
- All Neural2/Wavenet voices = same price

### Estimated Monthly Cost
```
Average quiz: 750 characters
Users: 1,000/month
Quizzes per user: 5

Total: 750 × 5 × 1,000 = 3.75M chars
With 60% cache hit: 1.5M actual API calls
Cost: 1.5M × $16/million = $24/month

With free tier (1M chars): $8/month
```

**Recommendation:** Choose the best voice for user experience, not cost. All high-quality voices cost the same.

---

## Troubleshooting

### Script Fails Immediately

**Error:** "Missing Google Cloud credentials"

**Fix:**
```bash
# Verify .env.local exists and has credentials
cat .env.local | grep GOOGLE

# Should show:
# GOOGLE_SERVICE_ACCOUNT_EMAIL=...
# GOOGLE_PRIVATE_KEY=...
```

### Some Voices Fail

**Error:** "Permission denied" or "API not enabled"

**Fix:**
1. Enable Cloud Text-to-Speech API:
   ```
   https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
   ```

2. Check service account permissions:
   - Go to IAM & Admin > Service Accounts
   - Verify role: **Cloud Text-to-Speech User**

### All Voices Fail

**Error:** "Authentication failed"

**Fix:**
```bash
# Check if private key has proper line breaks
node -e "console.log(process.env.GOOGLE_PRIVATE_KEY)"

# Should show: -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
# If not, ensure \\n is escaped properly in .env.local
```

---

## Summary

### What We Created ✅

1. ✅ **Voice comparison script** - Generates 36 audio samples
2. ✅ **Interactive HTML player** - Easy side-by-side comparison
3. ✅ **Comprehensive guide** - Voice recommendations and tips
4. ✅ **Documentation** - How to use and troubleshoot

### What You Can Do Now 🎯

1. **Run the script** to generate samples
2. **Open HTML player** for easy comparison
3. **Listen to all voices** on different devices
4. **Choose your favorite** based on recommendations
5. **Update TTS utility** with selected voice
6. **Test in Mini Challenge** to verify

### Next Steps 📋

1. **Generate samples:**
   ```bash
   node scripts/test-tts-voices.mjs
   ```

2. **Open player:**
   ```bash
   start voice-samples\compare.html
   ```

3. **Listen and compare**

4. **Update voice** in `lib/tts/google-tts.ts`

5. **Test and deploy**

---

🎤 **Ready to find your perfect voice!**
