# SoundTrek — Feature Roadmap

## Discovery & Browsing

### Categories

Filter and browse soundtracks by category (orchestral, fantasy, metal, chiptune, jazz, ambient, etc.).
Categories would be a curated top-level grouping, distinct from the existing `genre_tags` and `mood_tags`.
Could be a new `category` column on the `soundtracks` table, or derived from existing tags.

- Category picker on the home/discover screen narrows the random pool
- Could double as a landing page per category (e.g. `/category/metal`)

### Explore Page (Grid View)

A browsable grid of soundtracks — not one at a time, but many at once.

- Sortable by: popularity (likes), release year, recently added
- Filterable by category, mood, genre, console, decade
- Clicking a card goes to the full soundtrack view / starts playing it

### Composer Pages

A dedicated page per composer listing all their soundtracks in the database.

- `/composer/nobuo-uematsu`
- Shows bio (optional), discography within the app, total likes
- Composer name on each card is a clickable link

### "More Like This"

When listening to a soundtrack, surface similar ones based on shared tags/category.

- Sidebar or bottom sheet showing 3–5 suggestions
- Matching logic: shared mood_tags + genre_tags + category, ranked by overlap count

## Social & Engagement

### Likes / Popularity

Anonymous users can like a soundtrack. Likes are stored in the database and power the popularity sort.

- Schema: `likes` table with `soundtrack_id` + `session_id` (anonymous fingerprint stored in localStorage)
- One like per session per soundtrack (enforced client-side, with a unique constraint in the DB as backup)
- `soundtracks` table gets a `like_count` column (denormalised counter, updated via Supabase trigger or client-side increment)
- Liked state persisted in localStorage so the heart stays filled on return visits

### Favourites (localStorage)

Save soundtracks to a personal favourites list without an account.

- Stored in localStorage as an array of soundtrack IDs
- Favouriting also fires a like to the database
- Accessible via a `/favourites` page or a drawer/panel

### Recently Played (localStorage)

Track the last N soundtracks played in the current and past sessions.

- Stored in localStorage, capped at ~20 entries
- Shown in a "Recently Played" section on the explore page or a dedicated panel

## Navigation & Sharing

### Shareable Links

Every soundtrack gets a permanent URL: `/soundtrack/[id]` or `/?id=[id]`

- Loading that URL starts playback of that specific soundtrack
- "Share" button on the card copies the link to clipboard
- Open Graph meta tags (title, composer, cover art) so links unfurl nicely in Discord/Slack/Twitter

### Keyboard Shortcuts

- `Space` or `→` — Next soundtrack
- `←` — (if history exists) go back to previous
- `L` — Like / unlike
- `F` — Favourite / unfavourite
- `S` — Copy share link

### Swipe Gestures (Mobile)

- Swipe left — Next soundtrack
- Swipe right — (optional) go back
- Swipe up — Like

## Schema Changes Needed

```sql
-- New column on soundtracks
ALTER TABLE soundtracks ADD COLUMN category TEXT;
ALTER TABLE soundtracks ADD COLUMN like_count INT NOT NULL DEFAULT 0;

-- Likes table (anonymous, one per session per soundtrack)
CREATE TABLE likes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  soundtrack_id UUID NOT NULL REFERENCES soundtracks(id) ON DELETE CASCADE,
  session_id   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (soundtrack_id, session_id)
);

-- RLS: anyone can insert/read their own likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert" ON likes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public read"   ON likes FOR SELECT TO anon USING (true);

-- Trigger to keep like_count in sync
CREATE OR REPLACE FUNCTION increment_like_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE soundtracks SET like_count = like_count + 1 WHERE id = NEW.soundtrack_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_like_insert
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION increment_like_count();

CREATE OR REPLACE FUNCTION decrement_like_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE soundtracks SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.soundtrack_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_like_delete
  AFTER DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION decrement_like_count();
```

## Implementation Flags

### Likes without accounts

The anonymous `session_id` approach works but isn't abuse-proof — someone can clear localStorage and like again.
For v1 that's acceptable. If it becomes an issue later, rate-limiting by IP can be added at the Supabase edge without changing the schema.

### `like_count` denormalisation

Storing `like_count` directly on the `soundtracks` table (kept in sync via triggers) means the count is always fast to read with no `COUNT(*)` aggregation on every query.
Do this from the start — retrofitting a denormalised counter into an existing table with data is more painful than adding it now.

### Categories vs tags

The existing `mood_tags` and `genre_tags` columns handle nuance well, but a single top-level `category` field (e.g. `"metal"`, `"orchestral"`, `"chiptune"`) makes browsing cleaner and more approachable for casual users.
Decide on the category list and add the column **before** filling the database at scale, so you don't have to re-tag hundreds of rows later.
