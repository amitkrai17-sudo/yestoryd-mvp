'use client';

// =============================================================================
// SITE SETTINGS CONTEXT
// Provides session durations and other site settings to all client components
// Supports SSR hydration via initialDurations prop
// =============================================================================

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface SessionDurations {
  coaching: number;
  skillBuilding: number;
  checkin: number;
  discovery: number;
}

interface SiteSettingsContextType {
  sessionDurations: SessionDurations;
  isLoading: boolean;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

// V1 fallback – site_settings scheduling_duration_* is authoritative
const DEFAULT_DURATIONS: SessionDurations = {
  coaching: 45,
  skillBuilding: 45,
  checkin: 45,
  discovery: 45,
};

// =============================================================================
// CONTEXT
// =============================================================================

const SiteSettingsContext = createContext<SiteSettingsContextType>({
  sessionDurations: DEFAULT_DURATIONS,
  isLoading: true,
});

// =============================================================================
// PROVIDER
// =============================================================================

interface SiteSettingsProviderProps {
  children: ReactNode;
  initialDurations?: SessionDurations;
}

export function SiteSettingsProvider({
  children,
  initialDurations,
}: SiteSettingsProviderProps) {
  const [sessionDurations, setSessionDurations] = useState<SessionDurations>(
    initialDurations || DEFAULT_DURATIONS
  );
  const [isLoading, setIsLoading] = useState(!initialDurations);

  // Fetch durations if not provided via SSR
  useEffect(() => {
    if (initialDurations) {
      setIsLoading(false);
      return;
    }

    async function fetchDurations() {
      try {
        const res = await fetch('/api/settings/durations');
        const data = await res.json();

        if (data.success && data.durations) {
          setSessionDurations(data.durations);
        }
      } catch (error) {
        console.error('[SiteSettingsContext] Failed to fetch durations:', error);
        // Keep defaults on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchDurations();
  }, [initialDurations]);

  return (
    <SiteSettingsContext.Provider value={{ sessionDurations, isLoading }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Get session durations from site settings
 * Returns durations object with coaching, skillBuilding, checkin, discovery values
 */
export function useSessionDurations(): SessionDurations {
  const context = useContext(SiteSettingsContext);
  return context.sessionDurations;
}

/**
 * Get full site settings context including loading state
 */
export function useSiteSettings(): SiteSettingsContextType {
  return useContext(SiteSettingsContext);
}
