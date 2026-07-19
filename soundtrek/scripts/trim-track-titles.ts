/**
 * SoundTrek Track Title Trim Script
 *
 * Rewrites tracks.title in place, stripping video-title noise (game name,
 * composer, "OST"/"Official Soundtrack", quality tags, track numbers) down
 * to the bare track name via cleanTrackTitle. Idempotent — running it over
 * already-cleaned titles is a no-op. Unavailable rows are left untouched.
 *
 * Raw titles are recoverable at any time with
 * `npx tsx scripts/sync-tracklists.ts --force` (which now also applies the
 * same cleaning, so sync and trim can't fight each other).
 *
 * Usage:
 *   npx tsx scripts/trim-track-titles.ts --dry-run     # preview only
 *   npx tsx scripts/trim-track-titles.ts --dry-run --sample=100
 *   npx tsx scripts/trim-track-titles.ts               # apply
 *   npx tsx scripts/trim-track-titles.ts --limit=500   # first N soundtracks
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { cleanTracklistTitles } from "../src/utils/trackTitle";

const SUPABASE_URL = requireEnv("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_KEY = requireEnv("SUPABASE_SERVICE_KEY");

const DRY_RUN = process.argv.includes("--dry-run");
const SAMPLE = parseInt(
  process.argv.find((a) => a.startsWith("--sample="))?.split("=")[1] ?? "40",
);
const LIMIT = parseInt(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "1000000",
);

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface SoundtrackMeta {
  id: string;
  game_title: string;
  composers: string[];
  studio: string;
}

interface TrackRow {
  soundtrack_id: string;
  position: number;
  video_id: string;
  title: string;
  unavailable: boolean;
}

// PostgREST caps responses at 1000 rows — page through.
async function fetchAll<T>(
  table: string,
  columns: string,
  order: string,
): Promise<T[]> {
  const rows: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order.split(",")[0], { ascending: true })
      .order(order.split(",")[1] ?? order.split(",")[0], { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

async function main() {
  console.log(`Track title trim${DRY_RUN ? " (dry run)" : ""}`);

  const soundtracks = await fetchAll<SoundtrackMeta>(
    "soundtracks",
    "id, game_title, composers, studio",
    "created_at",
  );
  const meta = new Map(soundtracks.map((s) => [s.id, s]));

  const tracks = await fetchAll<TrackRow>(
    "tracks",
    "soundtrack_id, position, video_id, title, unavailable",
    "soundtrack_id,position",
  );
  console.log(`${tracks.length} tracks across ${meta.size} soundtracks loaded`);

  const allowed = new Set(
    [...meta.keys()].slice(0, LIMIT),
  );

  const bySoundtrack = new Map<string, TrackRow[]>();
  for (const t of tracks) {
    const rows = bySoundtrack.get(t.soundtrack_id);
    if (rows) rows.push(t);
    else bySoundtrack.set(t.soundtrack_id, [t]);
  }

  const changed: (TrackRow & { old_title: string })[] = [];
  for (const [sid, rows] of bySoundtrack) {
    const s = meta.get(sid);
    if (!s || !allowed.has(sid)) continue;
    rows.sort((a, b) => a.position - b.position);
    const cleaned = cleanTracklistTitles(
      rows.map((r) => ({ title: r.title, unavailable: r.unavailable })),
      { gameTitle: s.game_title, composers: s.composers, studio: s.studio },
    );
    rows.forEach((r, i) => {
      if (!r.unavailable && cleaned[i] !== r.title) {
        changed.push({ ...r, old_title: r.title, title: cleaned[i] });
      }
    });
  }

  console.log(`${changed.length} titles would change\n`);

  // Show a random sample of before → after for review.
  const shuffled = [...changed].sort(() => Math.random() - 0.5);
  for (const t of shuffled.slice(0, SAMPLE)) {
    const game = meta.get(t.soundtrack_id)?.game_title ?? "?";
    console.log(`  [${game}]`);
    console.log(`    - ${t.old_title}`);
    console.log(`    + ${t.title}`);
  }

  if (DRY_RUN) {
    console.log("\nDry run — nothing written.");
    return;
  }

  const CHUNK = 500;
  for (let i = 0; i < changed.length; i += CHUNK) {
    const batch = changed
      .slice(i, i + CHUNK)
      .map(({ old_title, ...row }) => row);
    const { error } = await supabase
      .from("tracks")
      .upsert(batch, { onConflict: "soundtrack_id,position" });
    if (error) throw new Error(`upsert failed at ${i}: ${error.message}`);
    process.stdout.write(
      `\r  updated ${Math.min(i + CHUNK, changed.length)}/${changed.length}`,
    );
  }
  console.log(`\nDone. ${changed.length} titles updated.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
