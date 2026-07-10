-- SoundTrek: server-side sortable combined likes + rating_count total.
--
-- TopView.vue paginates "Top Soundtracks" via .order() + .range() against
-- Postgres directly (PostgREST), which can't order by a computed expression
-- like `likes + rating_count` — only by a real column. This generated column
-- keeps that total in sync automatically on every write, so the DB can sort
-- on it directly.
ALTER TABLE soundtracks
  ADD COLUMN IF NOT EXISTS total_likes INT
  GENERATED ALWAYS AS (likes + COALESCE(rating_count, 0)) STORED;

CREATE INDEX IF NOT EXISTS idx_soundtracks_total_likes ON soundtracks (total_likes DESC);
