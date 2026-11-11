import { supabase } from "@/lib/supabase";
import {
  cleanTracklistTitles,
  type TrackTitleContext,
} from "@/utils/trackTitle";

// Single-soundtrack version of scripts/sync-tracklists.ts replaceTracks():
// fetch the playlist via the worker, clean titles the same way, then replace
// the soundtrack's rows in the tracks table. Fetches BEFORE deleting so a
// dead playlist never wipes an existing good tracklist. A null playlist clears
// the tracklist. Returns a short human-readable note on what happened.
export async function syncTracklist(
  soundtrackId: string,
  playlistId: string | null,
  meta: Omit<TrackTitleContext, "trackNumber">,
): Promise<string> {
  let rows: {
    soundtrack_id: string;
    position: number;
    video_id: string;
    title: string;
    unavailable: boolean;
  }[] = [];

  if (playlistId) {
    const proxyUrl = import.meta.env.VITE_YOUTUBE_PROXY_URL;
    if (!proxyUrl) throw new Error("VITE_YOUTUBE_PROXY_URL not configured");
    const res = await fetch(`${proxyUrl}/playlist/${playlistId}`);
    if (!res.ok) throw new Error(`playlist fetch failed (HTTP ${res.status})`);
    const items = (await res.json()) as {
      videoId: string;
      title: string;
      unavailable: boolean;
    }[];
    if (!items.length) throw new Error("playlist empty or unavailable");

    const titles = cleanTracklistTitles(
      items.map((it) => ({ title: it.title, unavailable: it.unavailable })),
      meta,
    );
    rows = items.map((item, i) => ({
      soundtrack_id: soundtrackId,
      position: i,
      video_id: item.videoId,
      title: titles[i],
      unavailable: item.unavailable,
    }));
  }

  const { error: delError } = await supabase
    .from("tracks")
    .delete()
    .eq("soundtrack_id", soundtrackId);
  if (delError) throw new Error(`tracks delete failed: ${delError.message}`);

  if (!rows.length) return "tracklist cleared";

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("tracks")
      .insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`tracks insert failed: ${error.message}`);
  }

  const dead = rows.filter((r) => r.unavailable).length;
  return `tracklist synced (${rows.length} tracks${dead ? `, ${dead} unavailable` : ""})`;
}
