CREATE TABLE contact_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT,
  email      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can insert contact messages"
  ON contact_messages FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "service role full access on contact messages"
  ON contact_messages FOR ALL TO service_role
  USING (true);
