'use client';

import { createContext, useContext } from 'react';
import { PortalType, PortalTheme, portalThemes } from '@/lib/theme';

interface ThemeContextValue {
  portal: PortalType;
  theme: PortalTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  portal,
  children,
}: {
  portal: PortalType;
  children: React.ReactNode;
}) {
  const theme = portalThemes[portal];

  return (
    <ThemeContext.Provider value={{ portal, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function usePortalTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('usePortalTheme must be used within a ThemeProvider');
  }
  return context;
}
