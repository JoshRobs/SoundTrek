-- SoundTrek: server-side search so the client no longer has to load the
-- entire soundtracks table to do a substring search. unaccent keeps search
-- accent-insensitive the way the old client-side normalize() did (e.g.
-- "pokemon" still matches "Pokémon").

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Title/studio/composer substring search, ranked by popularity. Read-only
-- and soundtracks is already public-read for anon, so this is a plain SQL
-- function rather than SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.search_soundtracks(q text, p_limit int DEFAULT 50)
RETURNS SETOF soundtracks
LANGUAGE sql
STABLE
AS $$
  SELECT s.*
  FROM soundtracks s
  WHERE unaccent(s.game_title) ILIKE '%' || unaccent(q) || '%'
  ORDER BY s.total_likes DESC NULLS LAST
  LIMIT p_limit;
$$;

-- Distinct composer name + track count for composers matching a query,
-- used for the "composer" suggestions in the search dropdown.
CREATE OR REPLACE FUNCTION public.search_composers(q text, p_limit int DEFAULT 5)
RETURNS TABLE(name text, count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT c AS name, count(*) AS count
  FROM soundtracks, unnest(composers) AS c
  WHERE unaccent(c) ILIKE '%' || unaccent(q) || '%'
  GROUP BY c
  ORDER BY count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_soundtracks(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_composers(text, int) TO anon, authenticated;
