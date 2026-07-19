-- SoundTrek 009: retire the saves feature — likes is now the single
-- bookmarking primitive (frontend: useSaves.ts deleted, /saved → /liked).
--
-- Existing saves are merged into user_likes first so nobody loses their
-- list (a save becomes a like), preserving each row's created_at so the
-- "Recently Added" sort order carries over. soundtracks.likes counters are
-- bumped for each newly created like so the public counts stay consistent
-- with user_likes (the toggle_soundtrack_like RPC keeps them in lockstep).
--
-- If you'd rather discard saved data outright, delete the WITH...UPDATE
-- statement and keep only the DROP.

WITH moved AS (
  INSERT INTO user_likes (user_id, soundtrack_id, created_at)
  SELECT user_id, soundtrack_id, created_at
  FROM user_saves
  ON CONFLICT (user_id, soundtrack_id) DO NOTHING
  RETURNING soundtrack_id
),
counts AS (
  SELECT soundtrack_id, count(*)::int AS cnt
  FROM moved
  GROUP BY soundtrack_id
)
UPDATE soundtracks s
SET likes = s.likes + c.cnt
FROM counts c
WHERE s.id::text = c.soundtrack_id;

DROP TABLE user_saves;
