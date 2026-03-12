-- Add min_children_threshold to coach_groups for tier progression
-- Previously hardcoded in CoachTierCard.tsx as rising:0, expert:30, master:75
ALTER TABLE coach_groups ADD COLUMN IF NOT EXISTS min_children_threshold integer NOT NULL DEFAULT 0;

-- Seed thresholds matching current hardcoded values
UPDATE coach_groups SET min_children_threshold = 0  WHERE name = 'rising';
UPDATE coach_groups SET min_children_threshold = 30 WHERE name = 'expert';
UPDATE coach_groups SET min_children_threshold = 75 WHERE name = 'master';
UPDATE coach_groups SET min_children_threshold = 0  WHERE name = 'founding';
UPDATE coach_groups SET min_children_threshold = 0  WHERE name = 'internal';
