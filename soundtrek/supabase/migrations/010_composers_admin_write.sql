-- SoundTrek 010: allow the admin user to write composers from the browser
-- (Composer Bios admin page). Mirrors the email-gated write policies that
-- already exist on soundtracks (created via dashboard, see pg_policies).
-- Upsert needs both INSERT and UPDATE.

CREATE POLICY "Admin can insert composers" ON composers
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'jdr.joshuaroberts@gmail.com');

CREATE POLICY "Admin can update composers" ON composers
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jdr.joshuaroberts@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jdr.joshuaroberts@gmail.com');
