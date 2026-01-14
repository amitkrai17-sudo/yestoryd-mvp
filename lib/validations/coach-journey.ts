// ============================================================
// COACH JOURNEY - ZOD VALIDATION SCHEMAS
// File: lib/validations/coach-journey.ts
// ============================================================

import { z } from 'zod';

// =====================================================
// SKILL TAGS
// =====================================================

export const SkillTagSchema = z.object({
  id: z.string().uuid(),
  tag_name: z.string().min(2).max(50),
  tag_slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  category: z.enum(['reading', 'writing', 'speech', 'special-needs', 'general']),
  description: z.string().max(200).optional(),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export type SkillTag = z.infer<typeof SkillTagSchema>;

// =====================================================
// COACH PROFILE
// =====================================================

export const CoachProfileUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  skill_tags: z.array(z.string()).min(1).max(20).optional(),
  years_experience: z.number().int().min(0).max(50).optional(),
  certifications: z.array(z.string()).max(10).optional(),
  timezone: z.string().default('Asia/Kolkata').optional(),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
  whatsapp_number: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
  city: z.string().max(100).optional(),
});

export type CoachProfileUpdate = z.infer<typeof CoachProfileUpdateSchema>;

// Admin can verify coach skills
export const CoachVerifySkillsSchema = z.object({
  coach_id: z.string().uuid(),
  verified_skills: z.array(z.string()).min(1),
  verification_notes: z.string().max(500).optional(),
});

export type CoachVerifySkills = z.infer<typeof CoachVerifySkillsSchema>;

// =====================================================
// AVAILABILITY SLOTS
// =====================================================

// Time format: HH:MM (24-hour)
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const AvailabilitySlotSchema = z.object({
  day_of_week: z.number().int().min(0).max(6).optional(),
  specific_date: z.string().datetime().optional(),
  start_time: z.string().regex(timeRegex, 'Invalid time format. Use HH:MM'),
  end_time: z.string().regex(timeRegex, 'Invalid time format. Use HH:MM'),
  slot_type: z.enum(['coaching', 'discovery', 'break', 'group']).default('coaching'),
  slot_duration_minutes: z.number().int().min(15).max(120).default(30),
  max_bookings_per_slot: z.number().int().min(1).max(10).default(1),
  is_available: z.boolean().default(true),
  notes: z.string().max(200).optional(),
}).refine(
  (data) => {
    // Must have either day_of_week OR specific_date, not both
    const hasDayOfWeek = data.day_of_week !== undefined;
    const hasSpecificDate = data.specific_date !== undefined;
    return hasDayOfWeek !== hasSpecificDate;
  },
  { message: 'Must specify either day_of_week OR specific_date, not both' }
).refine(
  (data) => {
    // end_time must be after start_time
    return data.end_time > data.start_time;
  },
  { message: 'End time must be after start time' }
);

export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

// Batch update availability (for drag-drop UI)
export const AvailabilityBatchUpdateSchema = z.object({
  slots_to_add: z.array(AvailabilitySlotSchema).max(50).optional(),
  slot_ids_to_remove: z.array(z.string().uuid()).max(50).optional(),
});

export type AvailabilityBatchUpdate = z.infer<typeof AvailabilityBatchUpdateSchema>;

// =====================================================
// SESSION FEEDBACK
// =====================================================

export const SessionFeedbackSchema = z.object({
  session_id: z.string().uuid(),
  
  // Existing fields (already in DB)
  focus_area: z.string().max(100).optional(),
  progress_rating: z.enum(['improved', 'same', 'struggled']).optional(),
  engagement_level: z.enum(['high', 'medium', 'low']).optional(),
  confidence_level: z.number().int().min(1).max(5).optional(),
  skills_worked_on: z.array(z.string()).max(10).optional(),
  
  // New structured feedback
  skills_improved: z.array(z.string()).max(10).optional(),
  skills_need_work: z.array(z.string()).max(10).optional(),
  next_session_focus: z.array(z.string()).max(5).optional(),
  
  // Text fields
  breakthrough_moment: z.string().max(500).optional(),
  concerns_noted: z.string().max(500).optional(),
  coach_notes: z.string().max(2000).optional(),
  
  // Homework
  homework_assigned: z.boolean().default(false),
  homework_topic: z.string().max(100).optional(),
  homework_description: z.string().max(500).optional(),
  
  // Flags
  flagged_for_attention: z.boolean().default(false),
  flag_reason: z.string().max(200).optional(),
  parent_communication_needed: z.boolean().default(false),
  
  // Overall rating
  rating_overall: z.number().int().min(1).max(5).optional(),
});

export type SessionFeedback = z.infer<typeof SessionFeedbackSchema>;

// =====================================================
// SESSION PREP
// =====================================================

export const SessionPrepSchema = z.object({
  session_id: z.string().uuid(),
  prep_notes: z.string().max(2000).optional(),
  prep_content_ids: z.array(z.string().uuid()).max(10).optional(),
});

export type SessionPrep = z.infer<typeof SessionPrepSchema>;

// =====================================================
// MESSAGES (Parent-Coach Chat)
// =====================================================

export const SendMessageSchema = z.object({
  child_id: z.string().uuid(),
  message_text: z.string().min(1).max(2000),
  message_type: z.enum(['text', 'image', 'file']).default('text'),
  attachment_url: z.string().url().optional(),
  attachment_name: z.string().max(200).optional(),
});

export type SendMessage = z.infer<typeof SendMessageSchema>;

export const GetMessagesSchema = z.object({
  child_id: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(), // For pagination
});

export type GetMessages = z.infer<typeof GetMessagesSchema>;

export const FlagMessageSchema = z.object({
  message_id: z.string().uuid(),
  flagged_reason: z.string().min(5).max(500),
});

export type FlagMessage = z.infer<typeof FlagMessageSchema>;

// =====================================================
// SMART MATCHING
// =====================================================

export const MatchingCriteriaSchema = z.object({
  child_id: z.string().uuid().optional(),
  learning_needs: z.array(z.string()).min(1).max(20),
  preferred_timezone: z.string().optional(),
  preferred_times: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string().regex(timeRegex),
    end_time: z.string().regex(timeRegex),
  })).optional(),
  exclude_coach_ids: z.array(z.string().uuid()).max(10).optional(),
  max_results: z.number().int().min(1).max(20).default(10),
});

export type MatchingCriteria = z.infer<typeof MatchingCriteriaSchema>;

// =====================================================
// CHILD LEARNING NEEDS (Auto-populated from assessment)
// =====================================================

export const UpdateChildNeedsSchema = z.object({
  child_id: z.string().uuid(),
  learning_needs: z.array(z.string()).max(20),
  primary_focus_area: z.string().max(50).optional(),
  parent_stated_goals: z.string().max(500).optional(),
});

export type UpdateChildNeeds = z.infer<typeof UpdateChildNeedsSchema>;

// =====================================================
// ADMIN AUDIT LOG
// =====================================================

export const AuditLogEntrySchema = z.object({
  action_type: z.string().min(1).max(50),
  action_category: z.enum(['shadow', 'verify', 'moderate', 'config', 'other']).optional(),
  target_type: z.enum(['coach', 'child', 'session', 'message', 'parent', 'enrollment']),
  target_id: z.string().uuid(),
  target_name: z.string().max(200).optional(),
  details: z.record(z.any()).optional(),
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// =====================================================
// BOOKING FLOW
// =====================================================

export const BookSessionSchema = z.object({
  child_id: z.string().uuid(),
  coach_id: z.string().uuid(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  scheduled_time: z.string().regex(timeRegex),
  session_type: z.enum(['coaching', 'discovery', 'parent_checkin', 'group']).default('coaching'),
  notes: z.string().max(500).optional(),
});

export type BookSession = z.infer<typeof BookSessionSchema>;

// Self-serve rescheduling
export const RescheduleSessionSchema = z.object({
  session_id: z.string().uuid(),
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  new_time: z.string().regex(timeRegex),
  reason: z.string().min(5).max(500),
}).refine(
  (data) => {
    // Check if new datetime is at least 4 hours from now
    const newDateTime = new Date(`${data.new_date}T${data.new_time}:00`);
    const fourHoursFromNow = new Date(Date.now() + 4 * 60 * 60 * 1000);
    return newDateTime >= fourHoursFromNow;
  },
  { message: 'Rescheduling must be at least 4 hours before the new session time' }
);

export type RescheduleSession = z.infer<typeof RescheduleSessionSchema>;

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface MatchedCoach {
  coach_id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  match_score: number;
  matched_skills: string[];
  unmet_needs: string[];
  available_slots_count: number;
  avg_rating: number;
  total_sessions_completed: number;
  years_experience: number;
}

export interface AvailableSlot {
  date: string;
  start_time: string;
  end_time: string;
  slot_type: string;
  is_booked: boolean;
}

export interface ChatMessage {
  id: string;
  child_id: string;
  sender_type: 'parent' | 'coach' | 'admin' | 'system';
  sender_id: string;
  sender_name: string;
  message_text: string;
  message_type: string;
  attachment_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ChildProgress {
  child_id: string;
  child_name: string;
  total_sessions: number;
  completed_sessions: number;
  skills_mastered: string[];
  skills_in_progress: string[];
  skills_need_work: string[];
  latest_rating: number | null;
  trend: 'improving' | 'stable' | 'declining';
  last_session_date: string | null;
}
