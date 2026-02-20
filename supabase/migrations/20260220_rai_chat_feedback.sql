-- rAI v2.1: Chat feedback table (thumbs up/down on AI responses)

CREATE TABLE IF NOT EXISTS rai_chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL,
  child_id UUID,
  user_query TEXT NOT NULL DEFAULT '',
  rai_response TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying feedback by rating and date
CREATE INDEX idx_rai_chat_feedback_rating ON rai_chat_feedback (rating, created_at DESC);
CREATE INDEX idx_rai_chat_feedback_user ON rai_chat_feedback (user_id, created_at DESC);
