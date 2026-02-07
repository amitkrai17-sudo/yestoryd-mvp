# TTS Voice Comparison Script

## Purpose

Generate audio samples for all Indian English voices to help you choose the best voice for Mini Challenge.

## What It Does

1. Generates 3 sample types for each voice:
   - **Question**: Quiz question sample
   - **Feedback**: Answer explanation sample
   - **Encouragement**: Short motivational phrase

2. Creates samples for 12 voices:
   - **Neural2** (4 voices) - Premium quality
   - **Wavenet** (4 voices) - High quality
   - **Standard** (4 voices) - Basic quality

3. Outputs:
   - 36 MP3 files in `voice-samples/` folder
   - Interactive HTML player for easy comparison
   - README with voice descriptions

## How to Run

```bash
# Run the script
node scripts/test-tts-voices.mjs
```

## Output

```
voice-samples/
├── compare.html              ← Open this in browser!
├── README.md                 ← Voice descriptions
├── en-IN-Neural2-A-question.mp3
├── en-IN-Neural2-A-feedback.mp3
├── en-IN-Neural2-A-encouragement.mp3
├── en-IN-Neural2-B-question.mp3
├── en-IN-Neural2-B-feedback.mp3
├── en-IN-Neural2-B-encouragement.mp3
├── ...
└── [36 total MP3 files]
```

## How to Compare Voices

### Option 1: Use the HTML Player (Recommended)

```bash
# Open in browser
start voice-samples/compare.html    # Windows
open voice-samples/compare.html     # Mac
xdg-open voice-samples/compare.html # Linux
```

The HTML player lets you:
- Play all voices side-by-side
- Compare question, feedback, and encouragement samples
- Easily identify your favorite voice

### Option 2: Play Individual Files

```bash
# Play specific voice samples (Windows PowerShell)
cd voice-samples
Start-Process en-IN-Neural2-A-question.mp3
Start-Process en-IN-Neural2-D-feedback.mp3
```

## Test Text Used

### Question Sample
```
"Which word rhymes with cat? Is it dog, bat, or sun?"
```

### Feedback Sample
```
"Great job! You got the answer right. The word bat rhymes with cat
because they both end with the at sound. Can you hear it?
Let's try another one!"
```

### Encouragement Sample
```
"You're doing amazing! Keep going!"
```

## Voice Recommendations

### For Young Children (Ages 4-7)

**Best Choices:**
1. **en-IN-Neural2-D** - Warmest, most kid-friendly
2. **en-IN-Wavenet-D** - Gentle and encouraging
3. **en-IN-Neural2-A** - Clear and friendly

**Why:** These voices have a warm, gentle tone that's engaging for young learners.

### For Older Children (Ages 8-12)

**Best Choices:**
1. **en-IN-Neural2-A** - Clear and professional
2. **en-IN-Neural2-D** - Warm but mature
3. **en-IN-Wavenet-A** - Natural and clear

**Why:** These voices sound more mature while remaining friendly.

### For All Ages

**Safe Choice:**
- **en-IN-Neural2-A** - Most versatile, works for all ages

## Voice Characteristics

### Neural2 Voices (Premium)

| Voice | Gender | Characteristics | Best For |
|-------|--------|----------------|----------|
| **Neural2-A** | Female | Clear, crisp, professional | Questions, instructions |
| **Neural2-B** | Male | Deep, authoritative | Older children |
| **Neural2-C** | Male | Light, friendly | General use |
| **Neural2-D** | Female | Warm, gentle, encouraging | Young children, feedback |

### Wavenet Voices (High Quality)

| Voice | Gender | Characteristics | Best For |
|-------|--------|----------------|----------|
| **Wavenet-A** | Female | Natural, clear | General use |
| **Wavenet-B** | Male | Professional | Instructions |
| **Wavenet-C** | Male | Friendly | Encouragement |
| **Wavenet-D** | Female | Gentle, kid-friendly | Young children |

### Standard Voices (Basic)

| Voice | Gender | Characteristics | Notes |
|-------|--------|----------------|-------|
| **Standard-A** | Female | Basic quality | Use only if needed |
| **Standard-B** | Male | Basic quality | Use only if needed |
| **Standard-C** | Male | Basic quality | Use only if needed |
| **Standard-D** | Female | Basic quality | Use only if needed |

**Note:** Standard voices have lower quality than Neural2/Wavenet. Use them only as fallback.

## How to Use Your Selected Voice

After comparing voices, update the TTS utility:

### Update `lib/tts/google-tts.ts`

```typescript
// Replace the voice name in generateSpeech() function
voice: {
  languageCode: 'en-IN',
  name: 'en-IN-Neural2-D', // ← Change this to your chosen voice
  ssmlGender: 'FEMALE' as const, // Or 'MALE'
}
```

### For Gemini Fallback

If using Gemini Pro TTS, the fallback voice should also be updated:

```typescript
// In generateSpeech() function (fallback)
voice: {
  languageCode: 'en-IN',
  name: 'en-IN-Neural2-D', // ← Your chosen fallback voice
  ssmlGender: 'FEMALE' as const,
}
```

## Cost Comparison

All voices have the same pricing:
- **$16 per 1 million characters**
- No difference in cost between Neural2, Wavenet, or Standard

**Recommendation:** Use Neural2 voices for best quality at same price.

## Script Details

### Requirements
- ✅ Google Cloud credentials in `.env.local`
- ✅ `@google-cloud/text-to-speech` package
- ✅ `dotenv` package

### What It Does Internally

1. Loads credentials from `.env.local`
2. Creates `voice-samples/` directory
3. For each voice:
   - Generates 3 audio samples (question, feedback, encouragement)
   - Saves as MP3 files
4. Creates `compare.html` for easy comparison
5. Creates `README.md` with voice descriptions

### Error Handling

If a voice fails to generate:
- Script continues with other voices
- Shows error message
- Final summary shows success/fail counts

### Expected Runtime

- **~30-60 seconds** for all 12 voices (36 samples)
- Depends on Google Cloud API response time

## Troubleshooting

### Error: "Missing Google Cloud credentials"

**Fix:** Ensure `.env.local` has:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Error: "Permission denied"

**Fix:** Ensure service account has **Text-to-Speech User** role in Google Cloud Console.

### Error: "API not enabled"

**Fix:** Enable Cloud Text-to-Speech API:
```
https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
```

### Error: "Quota exceeded"

**Fix:**
- Check quota usage in Google Cloud Console
- Wait for quota to reset
- Or increase quota limit

## Next Steps

1. **Run the script:**
   ```bash
   node scripts/test-tts-voices.mjs
   ```

2. **Open the HTML player:**
   ```bash
   start voice-samples/compare.html
   ```

3. **Listen to all voices** and note your favorites

4. **Update TTS utility** with your chosen voice

5. **Test in Mini Challenge:**
   ```bash
   npm run dev
   # Navigate to /mini-challenge/{childId}
   # Click "Listen" buttons
   ```

6. **Gather feedback** from children and parents

## Tips for Choosing

- **Play samples on different devices** (phone, tablet, laptop)
- **Consider your audience** - younger children prefer warmer voices
- **Test with actual content** from your Mini Challenge
- **Get feedback** from target users (children and parents)
- **Consider fatigue** - will the voice be pleasant after hearing it 10+ times?

---

🎤 **Happy voice testing!**
