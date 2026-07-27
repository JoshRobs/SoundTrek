-- SoundTrek 013: exclude the "Various Artists" placeholder credit from
-- composer search and the Top Composers leaderboard — it's not a real
-- composer, it just marks compilation/licensed-music soundtracks that have
-- no single credited author, so it shouldn't compete on those lists.

CREATE OR REPLACE FUNCTION public.search_composers(q text, p_limit int DEFAULT 5)
RETURNS TABLE(name text, count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT c AS name, count(*) AS count
  FROM soundtracks, unnest(composers) AS c
  WHERE unaccent(c) ILIKE '%' || unaccent(q) || '%'
    AND c <> 'Various Artists'
  GROUP BY c
  ORDER BY count DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE VIEW public.composer_stats AS
  SELECT c AS name,
         count(*) AS track_count,
         sum(total_likes) AS total_likes
  FROM soundtracks, unnest(composers) AS c
  WHERE c <> 'Various Artists'
  GROUP BY c;
