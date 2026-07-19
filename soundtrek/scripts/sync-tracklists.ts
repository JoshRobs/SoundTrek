/**
 * SoundTrek Tracklist Sync Script
 *
 * For every soundtrack with a youtube_playlist_id, fetches the playlist's
 * items from the youtube-proxy worker (which caches them in KV — running
 * this also pre-warms the player's playlist panel cache) and replaces the
 * soundtrack's rows in the tracks table.
 *
 * By default only soundtracks with no tracks rows yet are synced; --force
 * re-syncs everything (picking up playlist edits and newly-dead videos).
 *
 * Usage:
 *   npx tsx scripts/sync-tracklists.ts
 *   npx tsx scripts/sync-tracklists.ts --dry-run
 *   npx tsx scripts/sync-tracklists.ts --limit=50
 *   npx tsx scripts/sync-tracklists.ts --force
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { cleanTracklistTitles } from "../src/utils/trackTitle";

const SUPABASE_URL = requireEnv("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_KEY = requireEnv("SUPABASE_SERVICE_KEY");
const PROXY_URL = requireEnv("VITE_YOUTUBE_PROXY_URL").replace(/\/$/, "");

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const LIMIT = parseInt(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "10000",
);

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface PlaylistItem {
  videoId: string;
  title: string;
  unavailable: boolean;
}

// PostgREST caps responses at 1000 rows — page through.
async function syncedSoundtrackIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("tracks")
      .select("soundtrack_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to read tracks: ${error.message}`);
    for (const row of data ?? []) ids.add(row.soundtrack_id);
    if ((data ?? []).length < PAGE) break;
  }
  return ids;
}

async function fetchPlaylist(playlistId: string): Promise<PlaylistItem[]> {
  const res = await fetch(`${PROXY_URL}/playlist/${playlistId}`);
  if (!res.ok) throw new Error(`worker responded ${res.status}`);
  return (await res.json()) as PlaylistItem[];
}

interface SyncTarget {
  id: string;
  game_title: string;
  composers: string[];
  studio: string;
  youtube_playlist_id: string | null;
}

async function replaceTracks(s: SyncTarget, items: PlaylistItem[]) {
  const { error: delError } = await supabase
    .from("tracks")
    .delete()
    .eq("soundtrack_id", s.id);
  if (delError) throw new Error(`delete failed: ${delError.message}`);

  const titles = cleanTracklistTitles(
    items.map((it) => ({ title: it.title, unavailable: it.unavailable })),
    { gameTitle: s.game_title, composers: s.composers, studio: s.studio },
  );
  const rows = items.map((item, i) => ({
    soundtrack_id: s.id,
    position: i,
    video_id: item.videoId,
    title: titles[i],
    unavailable: item.unavailable,
  }));

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("tracks")
      .insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`insert failed: ${error.message}`);
  }
}

async function main() {
  console.log(
    `Tracklist sync${DRY_RUN ? " (dry run)" : ""}${FORCE ? " (force)" : ""}`,
  );

  // PostgREST caps responses at 1000 rows — page through.
  const soundtracks: SyncTarget[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("soundtracks")
      .select("id, game_title, composers, studio, youtube_playlist_id")
      .not("youtube_playlist_id", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to read soundtracks: ${error.message}`);
    soundtracks.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }

  const already = FORCE ? new Set<string>() : await syncedSoundtrackIds();
  const queue = soundtracks
    .filter((s) => !already.has(s.id))
    .slice(0, LIMIT);

  console.log(
    `${soundtracks.length} soundtracks with playlists, ` +
      `${already.size} already synced, ${queue.length} to sync\n`,
  );

  let synced = 0;
  let tracks = 0;
  let failed = 0;

  for (const s of queue) {
    try {
      const items = await fetchPlaylist(s.youtube_playlist_id!);
      if (items.length === 0) {
        console.log(`  ⚠ ${s.game_title}: playlist empty or unavailable`);
        failed++;
        continue;
      }
      if (!DRY_RUN) await replaceTracks(s, items);
      const dead = items.filter((i) => i.unavailable).length;
      console.log(
        `  ✓ ${s.game_title}: ${items.length} tracks` +
          (dead ? ` (${dead} unavailable)` : ""),
      );
      synced++;
      tracks += items.length;
    } catch (e) {
      console.log(`  ✗ ${s.game_title}: ${(e as Error).message}`);
      failed++;
    }
    await sleep(150);
  }

  console.log(
    `\nDone. ${synced} soundtracks synced (${tracks} tracks), ${failed} failed.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
