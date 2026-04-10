-- =============================================================================
-- BACKFILL: enrollments.program_description display rename
-- =============================================================================
-- Context: getProgramLabel() now returns '1:1 Coaching' for coaching enrollments
-- (was 'English Coaching Program'). But getProgramLabel()'s resolution order
-- prefers enrollment.program_description when set, which would still show the
-- old text for 7 existing coaching enrollments.
--
-- Update them to the new display name. Tuition enrollments keep their
-- category-specific labels (e.g., 'Grammar Sessions').
-- =============================================================================

UPDATE enrollments
SET program_description = '1:1 Coaching'
WHERE program_description = 'English Coaching Program';
