# SoundTrek

A discovery app for video game soundtracks, live at **[soundtrek.app](https://soundtrek.app)**.

Around 2,100 game OSTs — most with a full YouTube playlist — that you can browse by
composer, studio, console, genre or theme, play in a persistent background player,
like, review, and organise into your own collections.

---

## Features

**Discovery**

- Randomised discover feed, plus an Explore page with rows by genre, theme, console and decade
- Full-text search over games, composers and studios
- Composer pages (bio + portrait + discography), studio pages, category pages, "Top" charts
- Per-soundtrack tracklists, and track-level browsing

**Playback**

- Persistent YouTube-backed player that survives navigation, with a mobile mini-player
- Queue that mixes whole albums and individual tracks, with reordering and localStorage persistence
- Play a whole collection — album entries expand into their tracks in playlist order
- Spotify embeds and other streaming links where available

**Accounts** (Supabase Auth)

- Likes, reviews and star ratings
- Public/private collections of soundtracks _and_ individual tracks, browsable by everyone
- Admin area for adding/editing soundtracks, composer bios, links and Amazon cards

**SEO**

- Statically pre-rendered with `vite-ssg` — every soundtrack, composer and category page
  ships as real HTML
- Generated `sitemap.xml` and `rss.xml`, Open Graph tags via `@unhead/vue`

---

## Stack

| Layer      | Choice                                                                      |
| ---------- | --------------------------------------------------------------------------- |
| Frontend   | Vue 3 (`<script setup>`) + TypeScript + Vite, Pinia, Vue Router             |
| Pre-render | `vite-ssg` (routes enumerated from Supabase at build time)                  |
| Backend    | Supabase — Postgres + PostgREST + Auth + RLS                                |
| Schema     | Prisma (schema-of-record) + raw SQL migrations                              |
| Edge       | Cloudflare Worker (`workers/youtube-proxy`) — YouTube + catalog cache in KV |
| Hosting    | Netlify (SPA fallback to `index.html`)                                      |

### How the pieces fit

```
                 ┌──────────────────────────┐
   browser ────► │  Netlify (static + SPA)  │
                 └──────────┬───────────────┘
                            │
             ┌──────────────┴───────────────┐
             ▼                              ▼
  ┌─────────────────────┐        ┌──────────────────────┐
  │ Cloudflare Worker   │        │ Supabase             │
  │ /catalog            │        │ auth, likes, reviews │
  │ /playlist/:id       │◄──────►│ collections, tracks  │
  │ /playlist-info/:id  │  KV    │ (RLS on user data)   │
  │ /video-info/:id     │ cache  └──────────────────────┘
  └─────────┬───────────┘
            ▼
     YouTube Data API v3
```

The worker exists for two reasons: it keeps the YouTube API key off the client, and its
`/catalog` endpoint serves the whole soundtrack list from KV so Supabase isn't paying
~2 MB of egress per visitor. The frontend falls back to querying Supabase directly if the
worker is unreachable, and the admin always bypasses the cache (it needs fresh rows).

---

## Getting started

```bash
git clone <repo> && cd soundtrek
npm install
cp .env.example .env      # then fill it in — see below
npm run dev               # http://localhost:5173
```

To run the worker locally too:

```bash
cd workers/youtube-proxy
npm install
npx wrangler secret put YOUTUBE_API_KEY   # or use .dev.vars
npm run dev                                # http://localhost:8787
```

…and point `VITE_YOUTUBE_PROXY_URL=http://localhost:8787` in your `.env`.

Set `VITE_USE_MOCK_DATA=true` to run the frontend off `src/data/mockSoundtracks.ts`
with no Supabase project at all.

### Environment

See [.env.example](.env.example) for the annotated list. In short:

| Variable                                           | Used by            | Notes                                             |
| -------------------------------------------------- | ------------------ | ------------------------------------------------- |
| `DATABASE_URL`                                     | Prisma             | Direct connection (port **5432**), not the pooler |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`      | Browser + build    | Public by design                                  |
| `SUPABASE_SERVICE_KEY`                             | Scripts only       | **Never** expose to the browser                   |
| `VITE_YOUTUBE_PROXY_URL`                           | Browser            | Worker base URL                                   |
| `YOUTUBE_API_KEY`                                  | Ingestion + worker | Free tier ≈ 100 searches/day                      |
| `TWITCH_CLIENT_ID` / `_SECRET`                     | Ingestion          | IGDB credentials (game metadata + cover art)      |
| `SPOTIFY_CLIENT_ID` / `_SECRET`                    | Enrichment         | Client-credentials flow                           |
| `AMAZON_ACCESS_KEY` / `_SECRET`, `VITE_AMAZON_TAG` | Enrichment + UI    | Affiliate cards                                   |

---

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # type-check → sitemap → rss → vite-ssg static build
npm run preview    # serve the built site
```

`npm run build` is what Netlify runs; it needs the Supabase env vars because
route enumeration and the sitemap/RSS generators query the live database.

### Data scripts

All scripts are `tsx`, read `.env`, and share the same flags:
`--dry-run`, `--limit=N`, `--force` (re-process already-populated rows).
**Always dry-run first.**

| Script                                                          | What it does                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `scripts/ingest.ts`                                             | Pulls games from IGDB, finds YouTube soundtracks, inserts rows  |
| `enrich-composers`                                              | Composer credits via MusicBrainz release-group relations        |
| `enrich-bios`                                                   | Composer bio + portrait from Wikipedia/Wikidata                 |
| `enrich-descriptions` / `-themes` / `-keywords` / `-popularity` | IGDB metadata                                                   |
| `enrich-spotify`                                                | Best album/playlist match → `spotify_id`, `streaming_links`     |
| `enrich-video-ids`                                              | Single long-form video per OST via `youtubei.js` (no API quota) |
| `enrich-amazon`                                                 | Amazon PA API search → affiliate URL + image                    |
| `generate-slugs`                                                | Backfills the `slug` column (safe to re-run)                    |
| `sync-tracklists`                                               | Snapshots each YouTube playlist into the `tracks` table         |
| `trim-track-titles`                                             | Re-cleans `tracks.title` in place (idempotent)                  |
| `test-title-cleaner`                                            | Regression harness for the title cleaner                        |

The ones wired into `package.json`: `npm run enrich-composers`, `enrich-bios`,
`sync-tracklists`, `generate-sitemap`, `generate-rss`. The rest run via
`npx tsx scripts/<name>.ts`.

**Track titles.** YouTube playlist titles are noisy (`"Nobuo Uematsu - One-Winged Angel
(Final Fantasy VII OST) [HQ]"`). [src/utils/trackTitle.ts](src/utils/trackTitle.ts) strips
game name, composer and quality/noise segments per title, then makes a playlist-level pass
that removes any prefix shared by ≥80% of the playlist. It runs at sync time, in
`trim-track-titles`, and in the frontend's live fallback — so all three stay in agreement.
Change it and run `npx tsx scripts/test-title-cleaner.ts`.

---

## Database

Prisma models in [prisma/schema.prisma](prisma/schema.prisma) mirror the `public` schema;
the actual DDL lives in [supabase/migrations/](supabase/migrations/) and is applied with:

```bash
npx prisma db execute --file supabase/migrations/0XX_name.sql
npx prisma generate
```

Core tables: `soundtracks`, `composers`, `tracks`, `user_likes`, `collections`,
`collection_items`, `submissions`, `contact_messages`.

Two things worth knowing before you touch the schema:

- **`collection_items` is polymorphic.** `video_id IS NULL` → the item is a whole album;
  `video_id` set → a single track, with `track_title` snapshotted at add time. Uniqueness
  is enforced by two _partial_ unique indexes (see migration `012`) that Prisma's schema
  language can't express — don't "fix" this with a plain `@@unique`, which would forbid
  multiple tracks from one soundtrack.
- **PostgREST caps responses at 1000 rows.** Always page.

`collections` / `collection_items` were originally created in the Supabase dashboard, so
some Postgres objects still carry legacy `playlist*` names. RLS gates user data on
ownership; the admin area additionally checks `app_metadata.role === "admin"` in the
router guard.

---

## Layout

```
src/
  views/          route components (+ views/admin/ for the admin area)
  components/     player, cards, modals, panels
  stores/         pinia — player, queue, soundtracks, collections, composers
  composables/    auth, likes, reviews, player controls, infinite scroll
  utils/          trackTitle, slug, likes, collectionSummary
  lib/            supabase client + shared column selection
  router/         routes, auth guards, scroll restoration
scripts/          ingestion, enrichment, sitemap/RSS generation
supabase/         SQL migrations
prisma/           schema + config
workers/
  youtube-proxy/  Cloudflare Worker
```

**Player architecture.** Two layers, deliberately: [stores/queue.ts](src/stores/queue.ts)
is the _item_ queue (an ordered list of albums and tracks — what a collection seeds), and
[stores/player.ts](src/stores/player.ts) is the _track_ queue (navigation within the
current item). The queue store drives the player store, not the other way round. Both
persist to localStorage.

---

## Deploying

- **Frontend** — Netlify builds `npm run build`, publishes `dist`, SPA-redirects `/*` →
  `/index.html` ([netlify.toml](netlify.toml)). Supabase env vars must be set in the
  Netlify UI.
- **Worker** — `cd workers/youtube-proxy && npm run deploy`. The KV namespace id and the
  (public) Supabase anon credentials live in [wrangler.toml](workers/youtube-proxy/wrangler.toml);
  `YOUTUBE_API_KEY` is a Wrangler secret.

---

## Roadmap

[FEATURES.md](FEATURES.md) is the original v1 planning document. Most of it has shipped —
treat it as historical context rather than a to-do list.
