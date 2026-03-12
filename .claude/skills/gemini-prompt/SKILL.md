---
name: gemini-prompt
description: >
  Enforce Yestoryd's AI prompt architecture rules for Gemini integration.
  Use for ANY work involving Gemini AI, assessment prompts, scoring, audio analysis,
  session analysis, learning events, or AI-powered features.
  Trigger on: "Gemini", "assessment", "prompt", "scoring", "audio analysis",
  "reading assessment", "AI prompt", "anti-hallucination", "fluency", "age config",
  or any AI/ML feature work for Yestoryd.
  CRITICAL: Prevents the #1 architecture violation — inline hardcoded prompts.
---

# Gemini Prompt Skill — Yestoryd

## MANDATORY RULES (Zero Exceptions)

1. **Assessment prompts MUST use builders** from `lib/gemini/assessment-prompts.ts`
2. **Age bracket logic MUST come from `getAgeConfig()`** — NEVER define age brackets inline
3. **NEVER hardcode a Gemini prompt inline** in a route file for assessment/scoring tasks
4. **Anti-hallucination rules MANDATORY** for any prompt analyzing audio — use `getAntiHallucinationRules()`
5. **Fluency enum:** `"Poor" | "Fair" | "Good" | "Excellent"` — no alternatives ever
6. **Overall scores computed SERVER-SIDE** (weighted average) — never asked from Gemini directly

## Before Writing Any AI Code

```bash
# Check existing prompt modules
ls lib/gemini/
# Check for shared anti-hallucination
grep -r "getAntiHallucinationRules" lib/ --include="*.ts" -l
# Check assessment prompt builders
grep -r "assessment-prompts" lib/ app/ --include="*.ts" -l
# Find any inline Gemini prompts (violations to fix)
grep -rn "generateContent\|gemini" app/api/ --include="*.ts" | grep -v "import"
```

## Architecture

```
lib/gemini/
├── assessment-prompts.ts    # Prompt builders for all assessment types
├── anti-hallucination.ts    # Shared getAntiHallucinationRules()
├── age-config.ts            # getAgeConfig() — age band parameters
└── [other modules]          # Session analysis, content generation, etc.
```

## Correct Pattern

```typescript
import { buildAssessmentPrompt } from '@/lib/gemini/assessment-prompts';
import { getAgeConfig } from '@/lib/gemini/age-config';
import { getAntiHallucinationRules } from '@/lib/gemini/anti-hallucination';

const ageConfig = getAgeConfig(childAge);
const prompt = buildAssessmentPrompt({
  type: 'reading-fluency',
  ageConfig,
  antiHallucination: getAntiHallucinationRules(),
  // ... other params
});

const result = await model.generateContent(prompt);
// Parse result, compute weighted score SERVER-SIDE
const overallScore = computeWeightedScore(parsedScores, weights);
```

## WRONG Pattern (Never Do This)

```typescript
// ❌ WRONG — inline prompt in route file
const prompt = `You are a reading assessor. The child is ${age} years old.
Rate fluency as: Bad, OK, Great...`; // Wrong enum!

// ❌ WRONG — asking Gemini for overall score
const prompt = `...Give an overall score out of 100`;

// ❌ WRONG — inline age brackets
const ageGroup = age < 7 ? 'young' : age < 10 ? 'mid' : 'old';
```

## Known Violations to Fix

These 3 inline prompts still need migrating to shared modules:
- `app/api/.../enrolled/route.ts`
- `lib/.../audio-analysis.ts`
- Micro-assessment route

When touching these files, migrate the prompts to `lib/gemini/`.

## Audio Analysis Special Rules

- Send audio DIRECTLY to Gemini (not STT-first) — preserves acoustic signals
- Anti-hallucination rules are non-negotiable for audio
- Gemini analyzes "how it was read" (prosody, hesitation, self-correction) not just words

## Model Selection

| Use Case | Model | Why |
|----------|-------|-----|
| Reading assessment (audio) | Gemini 2.5 Flash | Needs audio understanding |
| Session transcript analysis | Gemini 2.5 Flash | Dual-output coach + parent |
| Cost-sensitive paths | Gemini 2.5 Flash Lite | ~₹0.037/child |
| Complex reasoning | Gemini 2.5 Pro | Architecture decisions |
| Embeddings | gemini-embedding-001 | 768-dim, standardized |
