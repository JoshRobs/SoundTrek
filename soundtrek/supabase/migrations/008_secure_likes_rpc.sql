-- SoundTrek: replace direct client UPDATE access to soundtracks.likes with a
-- single RPC that can only ever add or subtract exactly 1, and dedupes
-- against user_likes for signed-in users so repeated calls can't inflate the
-- count. Closes two gaps found in production:
--   1. anon/authenticated could PATCH soundtracks.likes to any arbitrary
--      value directly (RLS only checked USING/WITH CHECK(true), never the
--      value being written).
--   2. authenticated additionally held a blanket column-level UPDATE grant
--      on every column of soundtracks (game_title, youtube_video_id, etc),
--      not just likes — a logged-in user could rewrite any field on any row.

CREATE OR REPLACE FUNCTION public.toggle_soundtrack_like(
  p_soundtrack_id uuid,
  p_delta int
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_changed    boolean := false;
  v_new_likes  integer;
BEGIN
  IF p_delta NOT IN (1, -1) THEN
    RAISE EXCEPTION 'delta must be 1 or -1';
  END IF;

  IF v_user_id IS NOT NULL THEN
    -- Signed-in: dedupe against user_likes so repeat calls no-op instead of
    -- stacking. One row per (user, soundtrack) is enforced by its PK.
    IF p_delta = 1 THEN
      INSERT INTO user_likes (user_id, soundtrack_id)
      VALUES (v_user_id, p_soundtrack_id::text)
      ON CONFLICT (user_id, soundtrack_id) DO NOTHING;
      v_changed := FOUND;
    ELSE
      DELETE FROM user_likes
      WHERE user_id = v_user_id AND soundtrack_id = p_soundtrack_id::text;
      v_changed := FOUND;
    END IF;
  ELSE
    -- Anonymous: no stable identity to dedupe against — same best-effort
    -- behavior as before, just bounded to +-1 per call instead of an
    -- arbitrary client-supplied value.
    v_changed := true;
  END IF;

  IF v_changed THEN
    UPDATE soundtracks
    SET likes = GREATEST(likes + p_delta, 0)
    WHERE id = p_soundtrack_id
    RETURNING likes INTO v_new_likes;
  ELSE
    SELECT likes INTO v_new_likes FROM soundtracks WHERE id = p_soundtrack_id;
  END IF;

  RETURN v_new_likes;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_soundtrack_like(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_soundtrack_like(uuid, int) TO anon, authenticated;

-- Direct UPDATE access is no longer needed for anon/authenticated — the RPC
-- above (SECURITY DEFINER) is the only write path now.
--
-- Table-level REVOKE (no column list) — authenticated's UPDATE was a
-- blanket table-level grant (pg_class.relacl), not column-scoped, so a
-- column-list REVOKE would silently no-op against it. This form strips both
-- the table-level grant and anon's column-scoped `likes` grant in one shot;
-- verified against the live schema, not assumed.
DROP POLICY IF EXISTS "allow_public_like" ON soundtracks;

REVOKE UPDATE ON soundtracks FROM anon, authenticated;
