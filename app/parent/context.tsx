'use client';

import { createContext, useContext } from 'react';

// ==================== TYPES ====================
export interface ParentData {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface ChildData {
  id: string;
  name: string;
  child_name?: string;
  age?: number;
  lead_status?: string;
}

export interface ParentContextType {
  user: any;
  parent: ParentData | null;
  children: ChildData[];
  selectedChildId: string | null;
  selectedChild: ChildData | null;
  setSelectedChildId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ==================== CONTEXT ====================
export const ParentContext = createContext<ParentContextType | null>(null);

export function useParentContext() {
  const context = useContext(ParentContext);
  if (!context) {
    throw new Error('useParentContext must be used within ParentLayout');
  }
  return context;
}
