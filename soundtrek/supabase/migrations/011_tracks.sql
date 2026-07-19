-- SoundTrek 011: per-soundtrack tracklists, sourced from YouTube playlists.
--
-- Rows are written only by scripts/sync-tracklists.ts (service role), which
-- replaces a soundtrack's rows wholesale on each sync. The frontend reads
-- them on SoundtrackView; if a soundtrack has no rows yet it falls back to
-- fetching the playlist live from the youtube-proxy worker.
--
-- position is the 0-based index within the YouTube playlist. title is a
-- snapshot of the video title at sync time, so a later deletion on YouTube
-- doesn't erase the track name. unavailable mirrors the worker's flag for
-- "Deleted video" / "Private video" entries.

CREATE TABLE IF NOT EXISTS tracks (
  soundtrack_id UUID NOT NULL REFERENCES soundtracks(id) ON DELETE CASCADE,
  position      INT NOT NULL,
  video_id      TEXT NOT NULL,
  title         TEXT NOT NULL,
  unavailable   BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (soundtrack_id, position)
);

ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tracks' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON tracks FOR SELECT USING (true);
  END IF;
END $$;

-- RLS with no write policies already blocks anon/authenticated writes; the
-- revoke makes the intent explicit and belt-and-braces.
REVOKE INSERT, UPDATE, DELETE ON tracks FROM anon, authenticated;
