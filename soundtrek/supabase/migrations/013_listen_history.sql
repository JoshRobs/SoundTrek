-- SoundTrek 013: per-user listen history.
--
-- Records which soundtracks a signed-in user has played and when, one row per
-- (user, soundtrack) with played_at bumped on replay (so a re-listen moves to
-- the top rather than duplicating). This is the durable, cross-device backing
-- store for the "Recently listened" rail and the signal source for
-- content-based "Curated for you" recommendations.
--
-- Anonymous visitors keep an equivalent list in localStorage on the client;
-- on sign-in it's merged up into this table (see src/composables/useListens.ts),
-- mirroring how likes work.
--
-- user_id references auth.users(id) (Supabase Auth) and is kept as a bare column
-- like user_likes / collections elsewhere in this schema.

CREATE TABLE IF NOT EXISTS public.listen_history (
  user_id       uuid        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  soundtrack_id uuid        NOT NULL REFERENCES public.soundtracks(id) ON DELETE CASCADE,
  played_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, soundtrack_id)
);

-- Recent-first reads per user (the "Recently listened" query).
CREATE INDEX IF NOT EXISTS listen_history_user_recent
  ON public.listen_history (user_id, played_at DESC);

ALTER TABLE public.listen_history ENABLE ROW LEVEL SECURITY;

-- A user may only ever see or write their own history.
CREATE POLICY "listen_history_select_own" ON public.listen_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "listen_history_insert_own" ON public.listen_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "listen_history_update_own" ON public.listen_history
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "listen_history_delete_own" ON public.listen_history
  FOR DELETE USING (auth.uid() = user_id);
