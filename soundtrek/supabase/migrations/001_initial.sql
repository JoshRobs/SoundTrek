-- SoundTrek: soundtracks table
CREATE TABLE soundtracks (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  game_title      TEXT        NOT NULL,
  composer        TEXT        NOT NULL,
  console         TEXT        NOT NULL,
  release_year    INT         NOT NULL,
  cover_image_url TEXT,
  youtube_playlist_id TEXT,
  youtube_video_id    TEXT,
  source_type     TEXT        NOT NULL CHECK (source_type IN ('playlist', 'video')),
  mood_tags       TEXT[]      DEFAULT '{}',
  genre_tags      TEXT[]      DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Public read access (no login required for v1)
ALTER TABLE soundtracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON soundtracks FOR SELECT TO anon USING (true);
