-- Migration: 20260313_book_library_activation
-- Purpose: Activate book library feature — book_votes table, new columns on books,
--          book_popularity view, vote_count trigger, RLS policies, site_settings
-- Author: Amit / Claude Code
-- Related: Book Library Phase 1

-- ═══════════════════════════════════════════════════
-- 1. NEW TABLE: book_votes
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS book_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES parents(id) ON DELETE SET NULL,
  vote_type TEXT NOT NULL DEFAULT 'kahani_request'
    CHECK (vote_type IN ('kahani_request', 'want_to_read', 'favorite')),
  vote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_votes_book_id ON book_votes(book_id);
CREATE INDEX IF NOT EXISTS idx_book_votes_child_id ON book_votes(child_id);
CREATE INDEX IF NOT EXISTS idx_book_votes_created_at ON book_votes(created_at DESC);

-- Prevent duplicate votes per child per book per type per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_book_votes_unique_daily
  ON book_votes(book_id, child_id, vote_type, vote_date);

-- ═══════════════════════════════════════════════════
-- 2. ADD COLUMNS TO books TABLE
-- ═══════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'rucha_review'
  ) THEN
    ALTER TABLE books ADD COLUMN rucha_review TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'buy_links'
  ) THEN
    ALTER TABLE books ADD COLUMN buy_links JSONB DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE books ADD COLUMN embedding vector(768);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'search_text'
  ) THEN
    ALTER TABLE books ADD COLUMN search_text TEXT
      GENERATED ALWAYS AS (
        COALESCE(title, '') || ' ' ||
        COALESCE(author, '') || ' ' ||
        COALESCE(description, '') || ' ' ||
        COALESCE(publisher, '')
      ) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'affiliate_url'
  ) THEN
    ALTER TABLE books ADD COLUMN affiliate_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'vote_count'
  ) THEN
    ALTER TABLE books ADD COLUMN vote_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Enable pg_trgm for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search GIN index using trigram ops (ILIKE/similarity support)
CREATE INDEX IF NOT EXISTS idx_books_search
  ON books USING gin(search_text gin_trgm_ops);

-- HNSW index for vector similarity (matches el_content_items pattern)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_books_embedding_hnsw'
  ) THEN
    CREATE INDEX idx_books_embedding_hnsw
      ON books
      USING hnsw (embedding vector_cosine_ops);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════
-- 3. book_popularity VIEW (drop first — column order differs from old view)
-- ═══════════════════════════════════════════════════

DROP VIEW IF EXISTS book_popularity;

CREATE VIEW book_popularity AS
SELECT
  b.id,
  b.title,
  b.author,
  b.slug,
  b.reading_level,
  b.age_min,
  b.age_max,
  b.cover_image_url,
  b.is_available_for_kahani_times,
  b.vote_count,
  b.times_read_in_sessions,
  COALESCE(recent_votes.count, 0) AS votes_this_month,
  b.average_rating
FROM books b
LEFT JOIN (
  SELECT book_id, COUNT(*) AS count
  FROM book_votes
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY book_id
) recent_votes ON recent_votes.book_id = b.id
WHERE b.is_active = true
ORDER BY recent_votes.count DESC NULLS LAST, b.vote_count DESC;

-- ═══════════════════════════════════════════════════
-- 4. vote_count TRIGGER
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_book_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE books SET vote_count = COALESCE(vote_count, 0) + 1 WHERE id = NEW.book_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE books SET vote_count = GREATEST(COALESCE(vote_count, 0) - 1, 0) WHERE id = OLD.book_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_book_vote_count ON book_votes;
CREATE TRIGGER trg_book_vote_count
  AFTER INSERT OR DELETE ON book_votes
  FOR EACH ROW EXECUTE FUNCTION update_book_vote_count();

-- ═══════════════════════════════════════════════════
-- 5. RLS POLICIES
-- ═══════════════════════════════════════════════════

ALTER TABLE book_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read book votes"
  ON book_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote"
  ON book_votes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own votes"
  ON book_votes FOR DELETE
  USING (parent_id = auth.uid());

-- Verify books table has public read RLS (add if missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'books' AND policyname = 'Anyone can read active books'
  ) THEN
    -- Only create if books has RLS enabled
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = 'books' AND rowsecurity = true
    ) THEN
      CREATE POLICY "Anyone can read active books"
        ON books FOR SELECT
        USING (is_active = true);
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════
-- 6. site_settings ENTRIES (value=jsonb, category NOT NULL)
-- ═══════════════════════════════════════════════════

INSERT INTO site_settings (category, key, value, description) VALUES
  ('content', 'library_enabled', '"true"'::jsonb, 'Enable/disable the public book library page'),
  ('content', 'library_hero_title', '"The Reading Corner"'::jsonb, 'Library page hero title'),
  ('content', 'library_hero_subtitle', '"1,500+ books curated by Rucha Rai, certified reading instructor. Expert picks matched to your child''s reading level."'::jsonb, 'Library page hero subtitle'),
  ('content', 'library_books_per_page', '"20"'::jsonb, 'Number of books per page in library browse'),
  ('content', 'kahani_voting_enabled', '"true"'::jsonb, 'Enable/disable Kahani Times book voting')
ON CONFLICT (key) DO NOTHING;
