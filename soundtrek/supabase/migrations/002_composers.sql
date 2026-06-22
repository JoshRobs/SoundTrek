-- SoundTrek: composers table
-- slug is the routing key (matches toSlug(soundtrack.composer))
CREATE TABLE composers (
  slug         TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  support_url  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Public read access (no login required)
ALTER TABLE composers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON composers FOR SELECT TO anon USING (true);

-- Admin-only write access (use service role key from your backend/dashboard)
CREATE POLICY "Service role write access"
  ON composers FOR ALL TO service_role USING (true);
