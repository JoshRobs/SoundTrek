/**
 * SoundTrek — Spotify enrichment script
 *
 * Uses the Spotify Web API (Client Credentials — no user login required) to
 * find the best album or playlist match for each soundtrack and writes
 * spotify_id + spotify_type to Supabase.  Also appends a Spotify entry to
 * streaming_links if one does not already exist.
 *
 * Requires a free Spotify developer app:
 *   https://developer.spotify.com/dashboard → create app → copy Client ID + Secret
 *
 * Add to your .env:
 *   SPOTIFY_CLIENT_ID=...
 *   SPOTIFY_CLIENT_SECRET=...
 *
 * Usage:
 *   npx tsx scripts/enrich-spotify.ts
 *   npx tsx scripts/enrich-spotify.ts --dry-run
 *   npx tsx scripts/enrich-spotify.ts --batch=200
 *   npx tsx scripts/enrich-spotify.ts --reset       # clear progress and restart
 *   npx tsx scripts/enrich-spotify.ts --overwrite   # also re-process rows that already have spotify_id
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import "dotenv/config";

const SPOTIFY_CLIENT_ID = requireEnv("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET = requireEnv("SPOTIFY_CLIENT_SECRET");
const SUPABASE_URL = requireEnv("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_KEY = requireEnv("SUPABASE_SERVICE_KEY");

const DRY_RUN = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");
const OVERWRITE = process.argv.includes("--overwrite");
const BATCH_SIZE = parseInt(
  process.argv.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? "200",
);
const PROGRESS_FILE = "scripts/.progress-spotify.json";

// Minimum confidence score to accept a result (0–10 scale).
// Lower = more permissive, higher = stricter (may leave more rows empty).
const MIN_SCORE = 3;

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Progress tracking ─────────────────────────────────────────────────────────
// Uses a cursor (last processed ID ordered ascending) instead of a list of IDs,
// so the Supabase query stays small regardless of how many rows have been processed.

interface Progress {
  lastId: string | null;
}

function loadProgress(): Progress {
  if (RESET || !existsSync(PROGRESS_FILE)) return { lastId: null };
  try {
    const raw = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    // Migrate old format (processedIds array → cursor)
    if (Array.isArray(raw.processedIds)) return { lastId: null };
    return raw as Progress;
  } catch {
    return { lastId: null };
  }
}

function saveProgress(p: Progress) {
  mkdirSync("scripts", { recursive: true });
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ── Spotify auth ──────────────────────────────────────────────────────────────

interface SpotifyToken {
  accessToken: string;
  expiresAt: number; // Date.now() ms
}

let cachedToken: SpotifyToken | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.accessToken;
  }

  const creds = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

// ── Spotify search ────────────────────────────────────────────────────────────

interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string; // "album" | "single" | "compilation"
  total_tracks: number;
  artists: { name: string }[];
  release_date: string;
  external_urls: { spotify: string };
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  owner: { display_name: string };
  tracks: { total: number };
  external_urls: { spotify: string };
}

interface SearchResult {
  id: string;
  type: "album" | "playlist";
  name: string;
  url: string;
  trackCount: number;
  score: number;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreAlbum(album: SpotifyAlbum, gameTitle: string): number {
  const normGame = normalize(gameTitle);
  const normName = normalize(album.name);
  let score = 0;

  // Title containment
  if (normName === normGame) score += 4;
  else if (normName.includes(normGame)) score += 3;
  else if (
    normGame
      .split(" ")
      .filter((w) => w.length > 3)
      .every((w) => normName.includes(w))
  )
    score += 1.5;

  // OST keywords
  if (normName.includes("original soundtrack")) score += 2;
  else if (normName.includes("ost")) score += 1.5;
  else if (normName.includes("soundtrack")) score += 1;

  // Prefer albums with more tracks (full OSTs have many)
  if (album.total_tracks >= 20) score += 1;
  else if (album.total_tracks >= 10) score += 0.5;

  // Prefer proper albums over compilations/singles
  if (album.album_type === "album") score += 0.5;

  // Penalise if name has extra words that imply it's something else
  if (
    normName.includes("cover") ||
    normName.includes("tribute") ||
    normName.includes("remix")
  )
    score -= 2;
  if (
    normName.includes("piano") ||
    normName.includes("orchestral") ||
    normName.includes("arrangement")
  )
    score -= 1;

  return Math.max(0, score);
}

function scorePlaylist(playlist: SpotifyPlaylist, gameTitle: string): number {
  const normGame = normalize(gameTitle);
  const normName = normalize(playlist.name);
  let score = 0;

  if (normName.includes(normGame)) score += 2;
  if (normName.includes("original soundtrack") || normName.includes("ost"))
    score += 1.5;
  else if (normName.includes("soundtrack")) score += 1;

  if ((playlist.tracks?.total ?? 0) >= 20) score += 0.5;

  if (normName.includes("cover") || normName.includes("tribute")) score -= 2;

  // Playlists are a weaker source than albums, cap them lower
  return Math.min(Math.max(0, score), 5);
}

async function fetchWithRetry(url: string, token: string): Promise<Response> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 429) {
      if (!res.ok) {
        const body = await res.text();
        console.log(`\n  [HTTP ${res.status}] ${body}`);
      }
      return res;
    }

    const body = await res.text();
    const retryRaw = Number(res.headers.get("Retry-After") ?? "10");
    console.log(`\n  [429] Retry-After: ${retryRaw}s | body: ${body}`);
    if (retryRaw > 3600) {
      console.log(
        `  Ban is ${Math.round((retryRaw / 3600) * 10) / 10}h — aborting. Try again later.`,
      );
      process.exit(1);
    }
    await sleep(retryRaw * 1000);
  }
  throw new Error("Spotify rate limit: too many retries");
}

async function searchSpotify(gameTitle: string): Promise<SearchResult | null> {
  const token = await getAccessToken();

  // Only search with the most targeted query first; fall back if score is low.
  // Fewer requests = less rate limiting.
  const queries = [`${gameTitle} original soundtrack`, `${gameTitle} ost`];

  const candidates: SearchResult[] = [];

  for (const q of queries) {
    const url =
      `https://api.spotify.com/v1/search?` +
      new URLSearchParams({
        q,
        type: "album,playlist",
        limit: "5",
        market: "US",
      });

    const res = await fetchWithRetry(url, token);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify search failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      albums: { items: SpotifyAlbum[] };
      playlists: { items: SpotifyPlaylist[] };
    };

    for (const album of data.albums?.items ?? []) {
      if (!album?.id) continue;
      const score = scoreAlbum(album, gameTitle);
      candidates.push({
        id: album.id,
        type: "album",
        name: album.name,
        url: album.external_urls.spotify,
        trackCount: album.total_tracks,
        score,
      });
    }

    for (const pl of data.playlists?.items ?? []) {
      if (!pl?.id) continue;
      const score = scorePlaylist(pl, gameTitle);
      candidates.push({
        id: pl.id,
        type: "playlist",
        name: pl.name,
        url: pl.external_urls.spotify,
        trackCount: pl.tracks?.total ?? 0,
        score,
      });
    }

    // Short-circuit: high-confidence album found, no need for second query
    const best = candidates.sort((a, b) => b.score - a.score)[0];
    if (best && best.type === "album" && best.score >= 6) break;

    // Delay between queries for the same game
    await sleep(2000);
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  return top.score >= MIN_SCORE ? top : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("SoundTrek — Spotify Enrichment");
  console.log(`  Batch size : ${BATCH_SIZE}`);
  console.log(`  Min score  : ${MIN_SCORE}`);
  if (DRY_RUN) console.log("  Mode       : DRY RUN (no writes)");
  if (OVERWRITE)
    console.log("  Overwrite  : yes (re-processes existing spotify_id rows)");
  if (RESET) console.log("  Progress   : reset");
  console.log("");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const progress = loadProgress();

  if (progress.lastId) console.log(`Resuming after ID: ${progress.lastId}`);

  // Cursor-based pagination: fetch rows with id > lastId, ordered by id.
  // This keeps the query tiny regardless of how many rows have been processed.
  let query = supabase
    .from("soundtracks")
    .select("id, game_title, studio, streaming_links, spotify_id")
    .order("id")
    .limit(BATCH_SIZE);

  if (!OVERWRITE) query = query.is("spotify_id", null);
  if (progress.lastId) query = query.gt("id", progress.lastId);

  const { data: rows, error } = await query;

  if (error) throw error;
  if (!rows?.length) {
    console.log("All rows processed (or none match the criteria).");
    return;
  }

  console.log(`Rows to process this run: ${rows.length}\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let failed = 0;

  for (const row of rows) {
    process.stdout.write(`→ ${row.game_title} `);

    let result: SearchResult | null = null;
    try {
      result = await searchSpotify(row.game_title);
    } catch (err) {
      console.log(`[ERROR: ${(err as Error).message}]`);
      failed++;
      progress.lastId = row.id;
      saveProgress(progress);
      await sleep(1000);
      continue;
    }

    if (!result) {
      console.log("[not found / low confidence]");
      notFound++;
    } else {
      process.stdout.write(
        `[${result.type}:${result.id} score=${result.score.toFixed(1)} tracks=${result.trackCount}] `,
      );

      if (!DRY_RUN) {
        const existingLinks: { platform: string; url: string }[] =
          Array.isArray(row.streaming_links) ? row.streaming_links : [];
        const hasSpotifyLink = existingLinks.some((l) => l.platform === "spotify");
        const newLinks = hasSpotifyLink
          ? existingLinks
          : [...existingLinks, { platform: "spotify", url: result.url }];

        const { error: updateError } = await supabase
          .from("soundtracks")
          .update({
            spotify_id: result.id,
            spotify_type: result.type,
            streaming_links: newLinks,
          })
          .eq("id", row.id);

        if (updateError) {
          console.log(`FAILED (${updateError.message})`);
          failed++;
        } else {
          console.log("✓");
          updated++;
        }
      } else {
        console.log("(dry run)");
        updated++;
      }
    }

    progress.lastId = row.id;
    saveProgress(progress);

    await sleep(3000);
  }

  // Remaining count: just how many null rows exist after our cursor
  const { count: remaining } = await supabase
    .from("soundtracks")
    .select("id", { count: "exact", head: true })
    .is("spotify_id", null);

  console.log(`
────────────────────────────────
Updated   : ${updated}
Not found : ${notFound}
Failed    : ${failed}
Skipped   : ${skipped}
Remaining : ${remaining ?? "?"} rows without Spotify
────────────────────────────────${(remaining ?? 0) > 0 ? "\nRun again to continue." : "\nAll done!"}
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
