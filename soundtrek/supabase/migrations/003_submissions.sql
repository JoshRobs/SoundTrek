CREATE TABLE submissions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_title   TEXT        NOT NULL,
  notes        TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can insert submissions"
  ON submissions FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "service role full access on submissions"
  ON submissions FOR ALL TO service_role
  USING (true);
