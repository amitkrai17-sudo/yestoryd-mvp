'use client';

import { createContext, useContext } from 'react';

// ==================== TYPES ====================
export interface CoachData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  photo_url?: string;
}

export interface CoachContextType {
  user: any;
  coach: CoachData | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// ==================== CONTEXT ====================
export const CoachContext = createContext<CoachContextType | null>(null);

export function useCoachContext() {
  const context = useContext(CoachContext);
  if (!context) {
    throw new Error('useCoachContext must be used within CoachLayout');
  }
  return context;
}
