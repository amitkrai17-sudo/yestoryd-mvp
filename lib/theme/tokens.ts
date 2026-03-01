// =============================================================================
// YESTORYD DESIGN TOKENS — Shared across all portals
// Single source of truth for spacing, colors, typography, layout dimensions
// =============================================================================

export const tokens = {
  // --- BRAND COLORS (never change per portal) ---
  colors: {
    brand: {
      pink: '#FF0099',
      blue: '#00ABFF',
      purple: '#7B008B',
      yellow: '#E6C600',
      whatsapp: '#25D366',
    },
    semantic: {
      success: '#22C55E',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6',
    },
    // Paper/ink for reading surfaces
    paper: '#FDFBF7',
    ink: '#18181b',
  },

  // --- RADIUS ---
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    full: '9999px',
  },

  // --- BUTTON HEIGHTS (touch targets) ---
  buttonHeight: {
    sm: '36px',
    md: '44px',
    lg: '48px',
    xl: '56px',
  },

  // --- SPACING ---
  spacing: {
    page: {
      x: { mobile: '16px', desktop: '24px' },
      y: { mobile: '16px', desktop: '24px' },
    },
    card: {
      padding: '20px',
      gap: '16px',
    },
    bottomNavHeight: '64px',
    topBarHeight: '64px',
  },

  // --- TYPOGRAPHY ---
  typography: {
    fontFamily: {
      display: 'var(--font-jakarta)',
      body: 'var(--font-inter)',
      reading: 'var(--font-reading)',
    },
  },

  // --- Z-INDEX ---
  zIndex: {
    sidebar: 40,
    mobileOverlay: 40,
    sidebarMobile: 50,
    bottomNav: 50,
    chatWidget: 60,
    modal: 70,
    toast: 80,
  },

  // --- SIDEBAR ---
  sidebar: {
    expandedWidth: 256,   // w-64
    collapsedWidth: 72,   // w-[72px]
  },
} as const;

export type DesignTokens = typeof tokens;

export default tokens;
