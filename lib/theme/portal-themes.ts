// =============================================================================
// YESTORYD PORTAL THEMES
// Each portal has a distinct visual identity: mode (light/dark), accent, surfaces
// =============================================================================

export type PortalType = 'parent' | 'coach' | 'admin';

export interface PortalTheme {
  mode: 'light' | 'dark';
  accent: string;          // Hex color for accent
  accentHover: string;     // Hex/rgba for accent hover state
  gradient: { from: string; to: string };

  bg: {
    page: string;          // Tailwind class for page background
    card: string;          // Tailwind class for card background
    sidebar: string;       // Tailwind class for sidebar background
    elevated: string;      // Tailwind class for elevated surfaces (modals, dropdowns)
    hover: string;         // Tailwind class for hover surface
  };

  text: {
    primary: string;       // Tailwind class
    secondary: string;
    tertiary: string;
    onAccent: string;      // Text color on accent-colored backgrounds
  };

  border: {
    subtle: string;        // Tailwind class for structural dividers
    default: string;       // Tailwind class for default borders
    card: string;          // Tailwind class for card borders (accent-tinted)
  };

  nav: {
    activeBg: string;      // Tailwind class for active nav item background
    activeText: string;    // Tailwind class for active nav item text/icon
    activeIndicator: string; // Tailwind class for active indicator (left bar)
    inactiveText: string;  // Tailwind class for inactive nav item text
    hoverBg: string;       // Tailwind class for nav item hover
  };

  cta: {
    primary: string;       // Tailwind classes for primary CTA button
    secondary: string;     // Tailwind classes for secondary/ghost button
  };

  badge: {
    bg: string;
    text: string;
  };
}

export const portalThemes: Record<PortalType, PortalTheme> = {
  // ===========================================================================
  // PARENT PORTAL — Light theme, Pink (#FF0099) accent
  // Warm, approachable, parent-friendly
  // ===========================================================================
  parent: {
    mode: 'light',
    accent: '#FF0099',
    accentHover: '#E6008A',
    gradient: { from: '#FF0099', to: '#7B008B' },

    bg: {
      page: 'bg-gray-50',
      card: 'bg-white',
      sidebar: 'bg-white',
      elevated: 'bg-white',
      hover: 'hover:bg-gray-100',
    },

    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      tertiary: 'text-gray-400',
      onAccent: 'text-white',
    },

    border: {
      subtle: 'border-gray-100',
      default: 'border-gray-200',
      card: 'border-gray-200',
    },

    nav: {
      activeBg: 'bg-[#FF0099]/10',
      activeText: 'text-[#FF0099]',
      activeIndicator: 'bg-[#FF0099]',
      inactiveText: 'text-gray-500',
      hoverBg: 'hover:bg-gray-100',
    },

    cta: {
      primary: 'bg-[#FF0099] hover:bg-[#E6008A] text-white',
      secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900',
    },

    badge: {
      bg: 'bg-[#FF0099]/10',
      text: 'text-[#FF0099]',
    },
  },

  // ===========================================================================
  // COACH PORTAL — Dark theme, Blue (#00ABFF) accent
  // Professional, focused workspace
  // ===========================================================================
  coach: {
    mode: 'dark',
    accent: '#00ABFF',
    accentHover: '#0099E6',
    gradient: { from: '#00ABFF', to: '#0066CC' },

    bg: {
      page: 'bg-[#0a0a0f]',
      card: 'bg-[#121217]',
      sidebar: 'bg-[#0f0f14]',
      elevated: 'bg-[#1a1a22]',
      hover: 'hover:bg-white/[0.05]',
    },

    text: {
      primary: 'text-white',
      secondary: 'text-gray-400',
      tertiary: 'text-gray-500',
      onAccent: 'text-white',
    },

    border: {
      subtle: 'border-white/[0.06]',
      default: 'border-white/[0.08]',
      card: 'border-white/[0.08]',
    },

    nav: {
      activeBg: 'bg-[#00ABFF]/10',
      activeText: 'text-[#00ABFF]',
      activeIndicator: 'bg-[#00ABFF]',
      inactiveText: 'text-gray-400',
      hoverBg: 'hover:bg-white/[0.05]',
    },

    cta: {
      primary: 'bg-[#00ABFF] hover:bg-[#0099E6] text-white',
      secondary: 'bg-white/[0.08] hover:bg-white/[0.12] text-white',
    },

    badge: {
      bg: 'bg-[#00ABFF]/10',
      text: 'text-[#00ABFF]',
    },
  },

  // ===========================================================================
  // ADMIN PORTAL — Dark theme, Neutral/Grey accent
  // Clean, utilitarian control panel
  // ===========================================================================
  admin: {
    mode: 'dark',
    accent: '#A0A0B0',
    accentHover: '#B0B0C0',
    gradient: { from: '#6B6B7B', to: '#4B4B5B' },

    bg: {
      page: 'bg-[#0a0a0f]',
      card: 'bg-[#121217]',
      sidebar: 'bg-[#0f0f14]',
      elevated: 'bg-[#1a1a22]',
      hover: 'hover:bg-white/[0.05]',
    },

    text: {
      primary: 'text-white',
      secondary: 'text-gray-400',
      tertiary: 'text-gray-500',
      onAccent: 'text-white',
    },

    border: {
      subtle: 'border-white/[0.06]',
      default: 'border-white/[0.08]',
      card: 'border-white/[0.08]',
    },

    nav: {
      activeBg: 'bg-white/10',
      activeText: 'text-white',
      activeIndicator: 'bg-white',
      inactiveText: 'text-gray-400',
      hoverBg: 'hover:bg-white/[0.05]',
    },

    cta: {
      // Admin primary CTA stays pink for visibility on dark bg
      primary: 'bg-[#FF0099] hover:bg-[#E6008A] text-white',
      secondary: 'bg-white/[0.08] hover:bg-white/[0.12] text-white',
    },

    badge: {
      bg: 'bg-white/10',
      text: 'text-gray-300',
    },
  },
};
