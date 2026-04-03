-- Migration: Add coach_voice_note_url to structured_capture_responses

ALTER TABLE structured_capture_responses
ADD COLUMN IF NOT EXISTS coach_voice_note_url TEXT;

COMMENT ON COLUMN structured_capture_responses.coach_voice_note_url IS 'Optional coach voice note recorded during structured capture. Uploaded to Supabase Storage.';
