// Support Components Export Barrel
// Usage: import { SupportForm, SupportWidget } from '@/components/support';

export { default as SupportForm } from './SupportForm';
export { default as SupportWidget } from './SupportWidget';

// Re-export types if needed
export type SupportCategory = 
  | 'session_issue'
  | 'technical_problem'
  | 'payment_billing'
  | 'coach_feedback'
  | 'general_question'
  | 'other';

export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_type: 'parent' | 'coach';
  user_email: string;
  user_name?: string;
  child_name?: string;
  category: SupportCategory;
  subject?: string;
  description: string;
  status: TicketStatus;
  priority: SupportPriority;
  assigned_to?: string;
  resolution_notes?: string;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
  updated_at: string;
}
