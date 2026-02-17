-- ============================================================================
-- Performance Indexes for Yestoryd
-- Date: 2026-02-14
-- Phase 1: Database Cleanup & Type Safety
-- ============================================================================
-- These indexes target the most common query patterns identified in the codebase.
-- All use IF NOT EXISTS for safe re-running.
-- ============================================================================

-- learning_events: rAI queries, profile synthesis, engagement tracking
-- Used by: lib/learningEvents.ts, lib/rai/*, app/api/learning-events/route.ts
CREATE INDEX IF NOT EXISTS idx_learning_events_type_child_created
ON learning_events (event_type, child_id, created_at DESC);

-- scheduled_sessions: coach dashboard, brief loading, session management
-- Used by: lib/scheduling/*, app/api/coach/sessions/*, app/api/sessions/*
CREATE INDEX IF NOT EXISTS idx_sessions_coach_scheduled_status
ON scheduled_sessions (coach_id, scheduled_at, status);

-- children: CRM filtering, lead management
-- Used by: app/admin/crm/page.tsx, app/api/admin/crm/*
CREATE INDEX IF NOT EXISTS idx_children_lead_status_created
ON children (lead_status, created_at DESC);

-- discovery_calls: coach discovery call list
-- Used by: app/api/discovery-call/*, app/coach/discovery-calls/*
CREATE INDEX IF NOT EXISTS idx_discovery_calls_coach_status
ON discovery_calls (coach_id, status, scheduled_at);

-- communication_logs: the confirmed active table (not communication_log singular)
-- Used by: lib/communication/index.ts, lib/notifications/admin-alerts.ts, 8+ API routes
CREATE INDEX IF NOT EXISTS idx_communication_logs_child_created
ON communication_logs (child_id, created_at DESC);

-- enrollments: frequently queried by coach, status, and child
-- Used by: app/api/enrollment/*, app/api/coach/*, lib/scheduling/*
CREATE INDEX IF NOT EXISTS idx_enrollments_coach_status
ON enrollments (coach_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_child_status
ON enrollments (child_id, status);
