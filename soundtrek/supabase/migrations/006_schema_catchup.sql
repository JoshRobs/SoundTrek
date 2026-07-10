-- SoundTrek: reconcile committed migration history with schema changes that
-- were applied directly against the database instead of through a migration.
--
-- Every statement here is idempotent and a no-op against a database that is
-- already up to date (i.e. production as of 2026-07-10). Its purpose is to
-- bring a *fresh* database — built only from 001-005 — up to the same shape
-- as production. Verified against the live schema via direct
-- information_schema/pg_policies inspection, not guesswork.

-- ── soundtracks: composer (single TEXT) -> composers (TEXT[]) ──────────────
-- Done by hand at some point; comma-separated names were split into an array.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'soundtracks' AND column_name = 'composer'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'soundtracks' AND column_name = 'composers'
  ) THEN
    ALTER TABLE soundtracks ADD COLUMN composers TEXT[];
    UPDATE soundtracks SET composers = string_to_array(composer, ', ');
    ALTER TABLE soundtracks ALTER COLUMN composers SET NOT NULL;
    ALTER TABLE soundtracks DROP COLUMN composer;
  END IF;
END $$;

-- ── soundtracks: studio was added after the initial migration ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'soundtracks' AND column_name = 'studio'
  ) THEN
    ALTER TABLE soundtracks ADD COLUMN studio TEXT NOT NULL DEFAULT '';
    ALTER TABLE soundtracks ALTER COLUMN studio DROP DEFAULT;
  END IF;
END $$;

-- ── soundtracks: mood_tags was dropped in favor of genre_tags/theme_tags ───
ALTER TABLE soundtracks DROP COLUMN IF EXISTS mood_tags;

-- ── soundtracks: streaming + metadata columns added ad hoc ─────────────────
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS theme_tags TEXT[];
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS keyword_tags TEXT[];
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS spotify_id TEXT;
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS spotify_type TEXT;
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS streaming_links JSONB NOT NULL DEFAULT '[]';
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS likes INT NOT NULL DEFAULT 0;
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION;
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS rating_count INT;
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS popularity DOUBLE PRECISION;
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS cover_image_url_hd TEXT;
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS amazon_url TEXT;
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS amazon_image_url TEXT;
ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS description TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'soundtracks' AND column_name = 'slug'
  ) THEN
    ALTER TABLE soundtracks ADD COLUMN slug TEXT UNIQUE;
  END IF;
END $$;

-- ── soundtracks: policy added ad hoc to let the like button work signed-out ─
-- The RLS policy alone permits UPDATE on any row; it does NOT restrict which
-- column, since row-security predicates can't see individual columns. The
-- column grant below is what actually confines anon to `likes` — production
-- already has both, this just makes it reproducible from a fresh DB.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'soundtracks' AND policyname = 'allow_public_like'
  ) THEN
    CREATE POLICY "allow_public_like"
      ON soundtracks FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE UPDATE ON soundtracks FROM anon;
GRANT UPDATE (likes) ON soundtracks TO anon;

-- ── composers: bio was added ad hoc ─────────────────────────────────────────
ALTER TABLE composers ADD COLUMN IF NOT EXISTS bio TEXT;

-- ── user_likes / user_saves: created ad hoc, no migration ever committed ───
-- Backs useLikes/useSaves (src/composables/useLikes.ts, useSaves.ts).
CREATE TABLE IF NOT EXISTS user_likes (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  soundtrack_id TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, soundtrack_id)
);

ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_likes' AND policyname = 'own rows'
  ) THEN
    CREATE POLICY "own rows" ON user_likes FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_saves (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  soundtrack_id TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, soundtrack_id)
);

ALTER TABLE user_saves ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_saves' AND policyname = 'own rows'
  ) THEN
    CREATE POLICY "own rows" ON user_saves FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
