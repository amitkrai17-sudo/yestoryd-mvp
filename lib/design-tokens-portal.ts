// =============================================================================
// YESTORYD PORTAL IDENTITY SYSTEM
// =============================================================================
// Each portal has a distinct accent color for brand differentiation.
// All portals share the same dark base palette.
// This file is the SINGLE SOURCE OF TRUTH for portal theming.
//
// Usage: Import portal config where needed, or reference as documentation
// for Claude Code / design decisions.
// =============================================================================

// --- SHARED DARK BASE (all portals) ---
export const surface = {
  0: '#0a0a0f',   // Page background (deepest)
  1: '#121217',   // Card backgrounds, sidebar, header
  2: '#1a1a22',   // Elevated elements, dropdowns, modals
  3: '#242430',   // Hover states on surface-2 elements
} as const;

export const text = {
  primary: '#ffffff',
  secondary: '#9ca3af',   // gray-400 equivalent
  tertiary: '#6b7280',    // gray-500 equivalent
  disabled: '#4b5563',    // gray-600 equivalent
} as const;

export const border = {
  subtle: 'rgba(255, 255, 255, 0.08)',   // border-white/[0.08] — structural dividers
  medium: 'rgba(255, 255, 255, 0.12)',   // border-white/[0.12] — input borders
  strong: '#3a3a48',                      // border-border token — form inputs
} as const;

// --- BRAND COLORS (shared across all portals) ---
export const brand = {
  pink: '#FF0099',
  blue: '#00ABFF',
  purple: '#7B008B',
  yellow: '#E6C600',       // WCAG-safe yellow (not #FFDE00)
  whatsapp: '#25D366',
} as const;

// --- PORTAL IDENTITY ---
export type PortalType = 'parent' | 'coach' | 'admin';

export interface PortalTheme {
  accent: string;
  accentHover: string;
  gradient: { from: string; to: string };
  border: {
    card: string;         // Tailwind class for card borders
    feature: string;      // Tailwind class for feature/highlight borders
  };
  badge: {
    bg: string;           // Tailwind class for badge background
    text: string;         // Tailwind class for badge text
  };
  nav: {
    active: string;       // Tailwind class for active nav text/icon
    inactive: string;     // Tailwind class for inactive nav text/icon
    hoverBg: string;      // Tailwind class for nav item hover
  };
  cta: {
    primary: string;      // Tailwind classes for primary CTA
    secondary: string;    // Tailwind classes for secondary CTA
  };
}

export const portalThemes: Record<PortalType, PortalTheme> = {
  // =========================================================================
  // PARENT PORTAL — Hot Pink (#FF0099) Dominant
  // =========================================================================
  // Pink = warm, nurturing, child-friendly. Parents see pink as the "Yestoryd
  // color" from the landing page, maintaining brand continuity.
  // =========================================================================
  parent: {
    accent: '#FF0099',
    accentHover: 'rgba(255, 0, 153, 0.9)',    // #FF0099/90
    gradient: { from: '#FF0099', to: '#7B008B' },
    border: {
      card: 'border-[#FF0099]/20',             // Subtle pink card borders
      feature: 'border-[#FF0099]/30',           // Stronger pink for feature cards
    },
    badge: {
      bg: 'bg-[#FF0099]/10',
      text: 'text-[#FF0099]',
    },
    nav: {
      active: 'text-[#FF0099]',
      inactive: 'text-text-tertiary',           // gray-500
      hoverBg: 'hover:bg-white/[0.05]',
    },
    cta: {
      primary: 'bg-[#FF0099] hover:bg-[#FF0099]/90 text-white',
      secondary: 'bg-white/[0.08] hover:bg-white/[0.12] text-white',
    },
  },

  // =========================================================================
  // COACH PORTAL — Electric Blue (#00ABFF) Dominant
  // =========================================================================
  // Blue = professional, trustworthy, focused. Coaches are professionals;
  // blue conveys the "workspace" feel and differentiates from parent pink.
  // =========================================================================
  coach: {
    accent: '#00ABFF',
    accentHover: 'rgba(0, 171, 255, 0.9)',     // #00ABFF/90
    gradient: { from: '#00ABFF', to: '#7B008B' },
    border: {
      card: 'border-[#00ABFF]/20',
      feature: 'border-[#00ABFF]/30',
    },
    badge: {
      bg: 'bg-[#00ABFF]/10',
      text: 'text-[#00ABFF]',
    },
    nav: {
      active: 'text-[#00ABFF]',
      inactive: 'text-text-tertiary',
      hoverBg: 'hover:bg-white/[0.05]',
    },
    cta: {
      primary: 'bg-[#00ABFF] hover:bg-[#00ABFF]/90 text-white',
      secondary: 'bg-white/[0.08] hover:bg-white/[0.12] text-white',
    },
  },

  // =========================================================================
  // ADMIN PORTAL — Deep Purple (#7B008B) Dominant
  // =========================================================================
  // Purple = authority, wisdom, premium. Admin is the control center;
  // purple feels elevated and distinct from both parent and coach portals.
  // =========================================================================
  admin: {
    accent: '#7B008B',
    accentHover: 'rgba(123, 0, 139, 0.9)',     // #7B008B/90
    gradient: { from: '#7B008B', to: '#FF0099' },
    border: {
      card: 'border-[#7B008B]/20',
      feature: 'border-[#7B008B]/30',
    },
    badge: {
      bg: 'bg-[#7B008B]/10',
      text: 'text-purple-400',                  // Lighter purple for readability on dark
    },
    nav: {
      active: 'text-purple-400',
      inactive: 'text-text-tertiary',
      hoverBg: 'hover:bg-white/[0.05]',
    },
    cta: {
      // Admin primary CTA stays pink for maximum contrast/visibility
      // Purple on dark is low-contrast, so we use pink for actionable elements
      primary: 'bg-[#FF0099] hover:bg-[#FF0099]/90 text-white',
      secondary: 'bg-white/[0.08] hover:bg-white/[0.12] text-white',
    },
  },
};

// --- TAILWIND CLASS MAPPING (Quick Reference for Claude Code) ---
//
// PARENT PORTAL CLASSES:
//   Page:          min-h-screen bg-surface-0
//   Card:          bg-surface-1 border border-[#FF0099]/20 rounded-2xl p-5
//   Feature card:  bg-surface-2 border border-[#FF0099]/30 rounded-2xl p-5
//   Primary CTA:   bg-[#FF0099] hover:bg-[#FF0099]/90 text-white rounded-xl
//   Secondary CTA: bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-xl
//   Active nav:    text-[#FF0099]
//   Badge:         bg-[#FF0099]/10 text-[#FF0099] rounded-full px-2.5 py-1 text-xs
//   Gradient:      bg-gradient-to-r from-[#FF0099] to-[#7B008B]
//   Stat number:   text-[#FF0099] text-2xl font-bold
//
// COACH PORTAL CLASSES:
//   Card:          bg-surface-1 border border-[#00ABFF]/20 rounded-2xl p-5
//   Feature card:  bg-surface-2 border border-[#00ABFF]/30 rounded-2xl p-5
//   Primary CTA:   bg-[#00ABFF] hover:bg-[#00ABFF]/90 text-white rounded-xl
//   Active nav:    text-[#00ABFF]
//   Badge:         bg-[#00ABFF]/10 text-[#00ABFF] rounded-full px-2.5 py-1 text-xs
//   Gradient:      bg-gradient-to-r from-[#00ABFF] to-[#7B008B]
//   Loading:       Loader2 text-[#00ABFF] animate-spin
//
// ADMIN PORTAL CLASSES:
//   Card:          bg-surface-1 border border-[#7B008B]/20 rounded-2xl p-5
//   Feature card:  bg-surface-2 border border-[#7B008B]/30 rounded-2xl p-5
//   Primary CTA:   bg-[#FF0099] hover:bg-[#FF0099]/90 text-white rounded-xl
//   Active nav:    text-purple-400
//   Badge:         bg-[#7B008B]/10 text-purple-400 rounded-full px-2.5 py-1 text-xs
//   Gradient:      bg-gradient-to-r from-[#7B008B] to-[#FF0099]
//   Loading:       Loader2 text-purple-400 animate-spin
//
// ALL PORTALS SHARED:
//   Text primary:     text-white
//   Text secondary:   text-text-secondary (gray-400)
//   Text tertiary:    text-text-tertiary (gray-500)
//   Structural border: border-white/[0.08]
//   Input border:     border-border (#3a3a48)
//   Input focus:      focus:border-{portal-accent} focus:ring-1 focus:ring-{portal-accent}/50
//   Hover surface:    hover:bg-white/[0.05]
//   Divider:          border-t border-white/[0.08]
//   Dropdown bg:      bg-surface-2 border border-white/[0.08]
