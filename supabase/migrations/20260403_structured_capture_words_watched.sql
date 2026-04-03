-- Migration: Add words_struggled and words_mastered to structured_capture_responses

ALTER TABLE structured_capture_responses
ADD COLUMN IF NOT EXISTS words_struggled TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS words_mastered TEXT[] DEFAULT '{}';
