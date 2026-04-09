# Emoji Audit Report - Yestoryd Codebase

**Generated:** January 2026
**Purpose:** Transform emoji usage for premium feel while preserving child-facing gamification

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **Total files with emojis** | 156 |
| **Files to KEEP (WhatsApp/Gamification/Celebrations)** | ~120 |
| **Files to TRANSFORM (Parent-facing/Marketing)** | ~36 |
| **Emojis to replace** | ~85 instances |
| **Emojis to keep** | ~200+ instances |

---

## KEEP Categories (No Changes)

### 1. WhatsApp Templates & Messages
**Reason:** WhatsApp engagement requires emojis for visual appeal and open rates

| File | Context |
|------|---------|
| `app/api/jobs/goals-capture/route.ts` | P7 WhatsApp trigger |
| `app/api/communication/*` | All WhatsApp templates |
| `app/enrollment/success/page.tsx` (line 42) | WhatsApp referral message |
| `lib/whatsapp/*` | WhatsApp template constants |
| Any file with `whatsapp` in path | WhatsApp context |

### 2. Child-Facing Gamification
**Reason:** Core to child engagement and learning motivation

| File | Emojis | Context |
|------|--------|---------|
| `components/child/BadgeUnlock.tsx` | ✨ ⭐ 🌟 🎉 | Achievement celebrations |
| `components/child/StreakFlame.tsx` | 🔥 ✨ | Streak animations |
| `components/child/XPProgressBar.tsx` | 🎉 ⭐ | Level up celebrations |
| `components/child/MascotGuide.tsx` | 🤩 🤔 🥳 🤗 👉 💡 🔊 👇 | Mascot expressions |
| `components/child/BottomNav.tsx` | 🏠 📚 🎮 👤 | Navigation icons |
| `components/child/QuestCard.tsx` | 🎯 📚 | Quest objectives |
| `components/elearning/CelebrationOverlay.tsx` | 🎉 🏆 🔥 🎁 ⭐ ⚡ | Event celebrations |
| `components/elearning/GamificationDisplay.tsx` | 🎬 📝 🎮 ⭐ | Stats cards |
| `components/elearning/XPAwardPopup.tsx` | ⚡ ✨ | XP notifications |
| `components/games/WordMatchGame.tsx` | ⭐ 🎮 | Game rewards |
| `components/games/PhonicsPopGame.tsx` | ⭐ 🎮 | Game rewards |
| `lib/gamification.ts` | 🌱 | Default level icon |

### 3. Console Logging (Backend)
**Reason:** Developer experience, not user-facing

| File | Context |
|------|---------|
| `lib/qstash.ts` | 📤 ❌ 🔥 📅 🗑️ ⚠️ - Job processing logs |
| `lib/googleCalendar.ts` | Calendar operation logs |
| `lib/calendar/operations.ts` | Calendar event logs |
| `lib/recall-auto-bot.ts` | Session recording logs |
| `app/api/admin/generate-embeddings/route.ts` | Progress logs |

### 4. Celebratory Moments
**Reason:** Universal celebration contexts

| File | Context |
|------|---------|
| `app/completion/[enrollmentId]/page.tsx` | Program completion |
| `app/quiz/[sessionId]/page.tsx` | Quiz completion |
| `components/elearning/QuizPlayer.tsx` | Quiz feedback |
| `components/Confetti.tsx` | Confetti component |

---

## TRANSFORM Categories (Replace Emojis)

### Priority 1: Landing Page & Marketing

#### `app/HomePageClient.tsx`
| Line | Current | Replacement |
|------|---------|-------------|
| 385 | `{ emoji: '😰', text: '"I hate reading"' }` | Remove emoji, use red circle indicator |
| 386 | `{ emoji: '📖', text: 'Avoids books' }` | Remove emoji, use icon |
| 387 | `{ emoji: '🐢', text: 'Reads slowly' }` | Remove emoji, use icon |
| 388 | `{ emoji: '😔', text: 'Losing confidence' }` | Remove emoji, use icon |
| 391 | `{ emoji: '😊', text: '"Can I read more?"' }` | Remove emoji, use green check |
| 392 | `{ emoji: '📚', text: 'Picks up books' }` | `<BookOpen />` icon |
| 393 | `{ emoji: '⚡', text: 'Reads fluently' }` | `<Zap />` icon |
| 394 | `{ emoji: '💪', text: 'Speaks confidently' }` | `<TrendingUp />` icon |

#### `components/MoneyBackGuarantee.tsx`
| Line | Current | Replacement |
|------|---------|-------------|
| 57 | `💯 100% Satisfaction Guarantee` | "100% Satisfaction Guarantee" (text only) |
| 103 | `🔒 Secure payment` | `<Lock />` icon |
| 107 | `⭐ 500+ happy parents` | `<Star />` icon |

#### `components/NinetyDayPromise.tsx`
| Line | Current | Replacement |
|------|---------|-------------|
| 9 | `icon: '📖'` | `<BookOpen />` |
| 13 | `icon: '🙋'` | `<Hand />` or CSS indicator |
| 17 | `icon: '📚'` | `<BookOpen />` |
| 21 | `icon: '💬'` | `<MessageCircle />` |

### Priority 2: Assessment Results Page

#### `app/assessment/results/[id]/page.tsx`
| Line | Current | Context | Action |
|------|---------|---------|--------|
| 36 | `emoji: '⭐'` | Score message | Remove - use CSS star |
| 44 | `emoji: '🌟'` | Score message | Remove - use CSS star |
| 52 | `emoji: '📖'` | Score message | Remove - use icon |
| 60 | `emoji: '🚀'` | Score message | Remove - use `<ArrowRight />` |
| 246 | `{msg.emoji}` | Certificate display | Remove - use CSS/icon |
| 269 | `💡` | Encouragement | Use `<Lightbulb />` |
| 316 | `✨` | Daily tip | Use `<Sparkles />` |
| 319 | `❤️` | Social proof | Remove entirely |
| 324 | `🚀` | CTA button | Remove - keep text clean |
| 332 | `📅` | Book call button | Use `<Calendar />` |
| 451 | `📝` | Daily words | Use `<FileText />` |
| 461 | `🔤` | Phonics focus | Remove - use CSS |
| 467 | `🎯` | Activity | Use `<Target />` |

### Priority 3: Admin & Coach Dashboards

#### `app/admin/page.tsx`
| Line | Current | Replacement |
|------|---------|-------------|
| 249 | `⚠️ Needs attention` | "Needs attention" (AlertTriangle icon already present) |

#### `app/coach/dashboard/page.tsx`
| Current | Replacement |
|---------|-------------|
| `👋` greeting | Remove or use `<Hand />` |
| `💡` tips | Use `<Lightbulb />` |

#### `app/admin/crm/page.tsx`
| Current | Context | Replacement |
|---------|---------|-------------|
| `✅` | Enrolled indicator | Use `<Check />` icon |
| `📞` | Follow-up | Use `<Phone />` icon |
| `❌` | Not interested | Use `<X />` icon |
| `👻` | No show | Remove - use text badge |
| `🔥 ☀️ ❄️` | Lead temperature | Use CSS color badges |

### Priority 4: Goals Constants

#### `lib/constants/goals.ts`
| Goal | Current | Replacement Strategy |
|------|---------|---------------------|
| reading | 📖 | Keep for child-facing, or use `<BookOpen />` |
| grammar | ✏️ | Use `<Pencil />` |
| comprehension | 🧠 | Use `<Brain />` |
| creative_writing | 🎨 | Use `<Palette />` |
| olympiad | 🏅 | Use `<Award />` |
| competition_prep | 🏆 | Use `<Trophy />` |
| speaking | 🎤 | Use `<Mic />` |

**Note:** Goals are used in both parent-facing (GoalsCapture) and potentially child-facing contexts. Consider keeping emojis in goals.ts but transforming in parent-facing components.

### Priority 5: Other Parent-Facing Pages

#### `app/lets-talk/page.tsx`
- Check for emojis in success messaging

#### `app/booking-confirmed/page.tsx`
- Check for celebratory emojis

#### `app/terms/page.tsx` & `app/privacy/page.tsx`
- Remove any emojis from legal pages

---

## Replacement Icon Mapping

```tsx
// Import from lucide-react
import {
  Target,      // 🎯
  Check,       // ✅ ✔️
  ArrowRight,  // 🚀 (context: CTAs)
  Sparkles,    // 🚀 ✨ (context: special)
  Star,        // ⭐
  BookOpen,    // 📚 📖
  Smartphone,  // 📱
  Lightbulb,   // 💡
  GraduationCap, // 🎓
  Phone,       // 📞
  Mail,        // 📧
  Calendar,    // 🗓️
  FileText,    // 📝
  IndianRupee, // 💰
  Trophy,      // 🏆
  AlertTriangle, // ⚠️
  X,           // ❌
  Lock,        // 🔒
  Users,       // 👨‍👩‍👧
  Baby,        // 🧒
  BarChart3,   // 📊
  Mic,         // 🎤
  Headphones,  // 🎧
  MessageCircle, // 💬
  Bell,        // 🔔
  Clock,       // ⏰
  TrendingUp,  // 📈
  PartyPopper, // 🎉 (only in celebratory contexts)
  Brain,       // 🧠
  Pencil,      // ✏️
  Palette,     // 🎨
  Award,       // 🏅
  Hand,        // 🙋
} from 'lucide-react';
```

---

## Implementation Order

1. **Phase 1:** `MoneyBackGuarantee.tsx`, `NinetyDayPromise.tsx` (simple, isolated)
2. **Phase 2:** `HomePageClient.tsx` (high impact, visible)
3. **Phase 3:** `app/assessment/results/[id]/page.tsx` (complex, many emojis)
4. **Phase 4:** Admin/Coach dashboards
5. **Phase 5:** `lib/constants/goals.ts` (careful - affects multiple components)

---

## Files NOT to Modify

- Any file in `components/child/*`
- Any file in `components/elearning/*` (except parent-facing elements)
- Any file in `components/games/*`
- WhatsApp message content
- Backend console.log statements
- Confetti/celebration overlays for children

---

## Post-Implementation Checklist

- [x] Run `npm run build` to verify no errors ✓ Build successful
- [ ] Test on mobile viewport (80%+ users)
- [ ] Verify Lucide icons render correctly
- [ ] Check admin dashboard for missing icons
- [ ] Verify goals display correctly in GoalsCapture
- [ ] Test assessment results page end-to-end

---

## Implementation Summary (Completed January 2026)

### Phase 1: MoneyBackGuarantee & NinetyDayPromise
- Replaced 💯 → ShieldCheck icon
- Replaced 🔒 → Lock icon
- Replaced ⭐ → Star icon (filled yellow)
- Replaced 📖🙋📚💬 → BookOpen, Hand, Library, MessageCircle icons

### Phase 2: HomePageClient TransformationVisual
- Removed emotion emojis from before/after visual
- Used colored dots (red) for "before" states
- Used CheckCircle icons (green) for "after" states
- Replaced "Signs you might notice" emojis with brand-colored dots
- Replaced 🚀 → Sparkles icon
- Replaced 💡 → Lightbulb icon
- Replaced ❤️ → Heart icon

### Phase 3: Assessment Results Page
- Removed emoji property from score messages
- Replaced big emoji display with Sparkles icon
- Replaced inline emojis with Lucide icons (Lightbulb, Sparkles, Calendar, FileText, BookOpen, Target)
- Kept WhatsApp share message emojis (engagement context)

### Phase 4: Admin/Coach Dashboards
- Removed ⚠️ from "Needs attention" text
- Removed emojis from CRM lead status badges
- Removed emojis from likelihood options (using CSS badges)
- Removed 👋 from coach greeting
- Replaced 💡 → Lightbulb icon

### Phase 5: GoalsCapture Component
- Created icon mapping for goals
- Replaced emojis with Lucide icons (BookOpen, Pencil, Brain, Palette, Award, Trophy, Mic)
- Kept emoji property in goals.ts for future child-facing contexts
