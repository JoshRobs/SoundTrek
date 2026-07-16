-- SoundTrek: aggregate composer leaderboard (track count + summed likes)
-- computed server-side so the Top Composers page can page through results
-- the same way /top does, instead of loading every soundtrack row to
-- aggregate client-side. composers is a text[] column, so this needs
-- unnest(); total_likes is soundtracks' existing generated column.

CREATE OR REPLACE VIEW public.composer_stats AS
  SELECT c AS name,
         count(*) AS track_count,
         sum(total_likes) AS total_likes
  FROM soundtracks, unnest(composers) AS c
  GROUP BY c;

GRANT SELECT ON public.composer_stats TO anon, authenticated;
