---
name: ui-component
description: >
  Build Yestoryd UI components and pages following the established design system.
  Use for ANY frontend work: pages, components, layouts, forms, dashboards, cards, modals.
  Trigger on: "component", "page", "UI", "form", "dashboard", "card", "modal", "layout",
  "button", "redesign", "parent portal", "coach portal", "admin portal", "mobile",
  "responsive", "theme", "dark mode", "light mode", or any visual/frontend work.
  Enforces: portal theming, rounded-xl buttons, rounded-2xl cards, mobile-first,
  no nested scroll, snap-x horizontal, single-column mobile, CRO patterns.
---

# UI Component Skill — Yestoryd

## Before Building Any UI

```bash
# Check for existing similar components
grep -r "ComponentName\|feature-keyword" components/ --include="*.tsx" -l
# Check shared UI library
ls components/ui/
# Check portal-specific components
ls components/parent/ components/coach/ components/admin/ 2>/dev/null
# Check theme tokens
cat lib/theme/tokens.ts | head -30
```

## Portal Theme System

**Source of truth:** `lib/theme/` — ThemeProvider + PortalLayout

| Portal | Theme | Accent | Primary CTA | Background |
|--------|-------|--------|-------------|------------|
| Parent | Light | `#FF0099` (Hot Pink) | `bg-[#FF0099] text-white` | `bg-white` |
| Coach | Dark | `#00ABFF` (Electric Blue) | `bg-[#00ABFF] text-white` | Dark surface |
| Admin | Dark | Neutral Grey | `bg-white text-[#0a0a0f]` | Dark surface |

**Use `usePortalTheme()` hook** for theme-aware components:
```typescript
import { usePortalTheme } from '@/components/providers/ThemeProvider';
const { theme, portalType } = usePortalTheme();
```

## Layout Chain (Never Break This)

```
app/[portal]/layout.tsx → [Portal]Layout → PortalLayout → ThemeProvider
  → Sidebar (desktop lg+, 256px expanded / 72px collapsed)
  → BottomNav (mobile <lg, 5 items max)
  → Content area (SINGLE scroll owner)
```

**PortalLayout owns the scroll.** Pages have natural height — NO `h-screen`, `max-h-screen`, `min-h-screen`, `overflow-y-auto` on page wrappers.

## Hard UI Rules

### Buttons
| Property | Rule |
|----------|------|
| Radius | `rounded-xl` ALWAYS (exception: `rounded-full` for icon-only circles) |
| Height | `h-9` (small), `h-10` (standard), `h-12` (primary CTA) — NO h-8, NO h-14 |
| Layout | Single row: `flex items-center gap-3` |
| Padding | `px-4` standard, `px-6` primary CTA |

### Cards
| Property | Rule |
|----------|------|
| Radius | `rounded-2xl` ALWAYS (16px) — NEVER `rounded-xl` for cards |
| Shadow | `shadow-sm` on light theme (parent), none on dark |
| Hover | Elevation change (`hover:shadow-md`) — NOT color change |
| Clickable | `cursor-pointer` + hover effect |

### Scrolling
- PortalLayout is the ONLY scroll owner
- Horizontal: `snap-x snap-mandatory` on container, `snap-start` on children
- Every card must be **fully visible** (no partial peek)
- NO carousels, NO arrow sliders, NO auto-rotation
- Loading states: `min-h-[60vh]` not `min-h-screen`

### Mobile-First (80%+ India Mobile)
- Single column full-width (`grid-cols-1`) for cards on mobile
- Exception: stat/metric cards (number + label) can be `grid-cols-2`
- Min 44px touch targets
- Bottom nav, not hamburger menu
- No clipped cards

### Typography
| Element | Classes |
|---------|---------|
| Page title | `text-xl sm:text-2xl font-bold font-display` |
| Section header | `text-lg font-semibold font-display` |
| Card title | `text-base font-semibold` |
| Body | `text-base font-body leading-relaxed` |
| Caption | `text-sm text-gray-500` |
| Small label | `text-xs font-medium uppercase tracking-wide` |

Fonts: Display = Plus Jakarta Sans (`font-display`), Body = Inter (`font-body`), Reading = Lexend (`font-reading`)

### Colors (NEVER Guess)
- Always use explicit text colors: `text-gray-900` on light, `text-white` on dark
- NEVER rely on inherited colors (causes white-on-white bugs)
- Inputs always: `text-gray-900 bg-white`
- Labels: `text-gray-700`
- Lucide React icons only — NO emojis

## CRO Components (Parent Portal)

Available CRO components — use when building parent-facing pages:
- `ProgressCelebration` — score improvement + streak + milestone
- `ReEnrollmentBanner` — dismissible nudge when ≤2 sessions remaining
- `ReferralCard` — compact referral with copy link + WhatsApp share

All CRO components hide when data unavailable (graceful degradation).
CRO settings from `site_settings` via `/api/parent/cro-settings/route.ts` (5-min cache).

## Page Template

```typescript
'use client';

import { usePortalTheme } from '@/components/providers/ThemeProvider';

export default function FeaturePage() {
  const { theme } = usePortalTheme();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-display">
          Page Title
        </h1>
        <p className="text-sm text-gray-500 mt-1">Description</p>
      </div>

      {/* Content — single column mobile, grid desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cards with rounded-2xl */}
      </div>
    </div>
  );
}
```
