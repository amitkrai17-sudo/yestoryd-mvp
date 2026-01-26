// =============================================================================
// YESTORYD DESIGN TOKENS
// Single source of truth for all design values
// =============================================================================

export const tokens = {
  colors: {
    brand: {
      primary: '#FF0099',
      secondary: '#00ABFF',
      accent: '#E6C600',
      premium: '#7B008B',
    },
    surface: {
      0: '#0a0a0f',
      1: '#121217',
      2: '#18181b',
      3: '#1f1f24',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a1a1aa',
      tertiary: '#71717a',
      muted: '#52525b',
    },
    border: {
      default: '#27272a',
      subtle: '#1f1f24',
    },
    semantic: {
      success: '#22C55E',
      error: '#EF4444',
      warning: '#F59E0B',
    },
    paper: '#FDFBF7',
    ink: '#18181b',
  },

  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    '3xl': '24px',
    full: '9999px',
  },

  shadows: {
    glowPink: '0 0 20px -5px rgba(255, 0, 153, 0.5)',
    glowBlue: '0 0 20px -5px rgba(0, 171, 255, 0.5)',
    cardHover: '0 0 30px -10px rgba(255, 0, 153, 0.15)',
    reading: '0 20px 60px -15px rgba(0, 0, 0, 0.5)',
    elevated: '0 10px 40px rgba(0, 0, 0, 0.3)',
  },

  transitions: {
    fast: '150ms ease',
    normal: '200ms ease',
    slow: '300ms ease',
  },

  touch: {
    min: '44px',
    recommended: '48px',
    large: '56px',
  },

  typography: {
    fontFamily: {
      display: 'var(--font-jakarta)',
      body: 'var(--font-inter)',
      reading: 'var(--font-reading)',
    },
  },
} as const;

// Type exports for TypeScript usage
export type DesignTokens = typeof tokens;
export type BrandColor = keyof typeof tokens.colors.brand;
export type SurfaceColor = keyof typeof tokens.colors.surface;
export type SemanticColor = keyof typeof tokens.colors.semantic;

export default tokens;
