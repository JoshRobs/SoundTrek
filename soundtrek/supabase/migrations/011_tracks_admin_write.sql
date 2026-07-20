-- SoundTrek 011: allow the admin user to rewrite tracklists from the browser
-- (Fix Links admin page re-syncs a soundtrack's tracks after a playlist-id
-- correction). Mirrors the email-gated policies on soundtracks/composers.
-- The rewrite is delete-then-insert, so both commands are needed.

CREATE POLICY "Admin can insert tracks" ON tracks
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'jdr.joshuaroberts@gmail.com');

CREATE POLICY "Admin can delete tracks" ON tracks
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jdr.joshuaroberts@gmail.com');
