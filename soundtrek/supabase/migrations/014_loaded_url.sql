-- SoundTrek 014: Loaded (loaded.com) store link per soundtrack.
--
-- Holds the plain loaded.com product page for the game. SoundtrackView wraps it
-- in the Impact affiliate tracking link at render time, so the raw product URL
-- is all that needs storing. NULL → the "Buy the game" link is hidden.

ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS loaded_url TEXT;
