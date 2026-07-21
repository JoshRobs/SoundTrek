-- SoundTrek 012: polymorphic collection items.
--
-- A collection_items row can now reference either a whole soundtrack (an
-- "album item") or a single track within one (a "track item"):
--
--   video_id IS NULL  → album item: the whole OST, rendered as one cover tile.
--   video_id IS NOT NULL → track item: one track (a YouTube video) from the
--                          soundtrack's playlist.
--
-- track_title is a snapshot of the cleaned track name taken at add time — the
-- same reasoning as tracks.title (see 011): a later deletion on YouTube must
-- not erase the name the user saved.
--
-- collection_items was created directly in Supabase (its objects still carry
-- the original "playlist" naming), so this is the first migration file to
-- touch it.

ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS video_id    TEXT,
  ADD COLUMN IF NOT EXISTS track_title TEXT;

-- The old UNIQUE (collection_id, soundtrack_id) forbade the same OST appearing
-- twice in a collection — which now wrongly blocks adding several tracks from
-- one soundtrack. Replace it with two partial unique indexes:
--   • at most one album item per (collection, soundtrack), and
--   • at most one track item per (collection, video).
-- An album item and individual track items from the same OST can coexist.
--
-- Every existing row has video_id NULL, so the album index enforces exactly the
-- same uniqueness the dropped constraint did — no existing row can violate it.
ALTER TABLE collection_items
  DROP CONSTRAINT IF EXISTS playlist_items_playlist_id_soundtrack_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS collection_items_album_uniq
  ON collection_items (collection_id, soundtrack_id)
  WHERE video_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS collection_items_track_uniq
  ON collection_items (collection_id, video_id)
  WHERE video_id IS NOT NULL;

-- RLS is unchanged: the existing policies gate writes purely on collection
-- ownership (auth.uid() = collections.user_id) and never reference the item
-- shape, so they cover track items as-is.
