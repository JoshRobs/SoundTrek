import type { CollectionItem } from "@/types/collection";

// A collection can hold whole-soundtrack "album" items (video_id null) and
// single "track" items (video_id set) — see migration 012. This renders a
// human count that names each kind, e.g. "3 albums · 12 tracks", collapsing to
// just the non-zero side. Accepts the loosely-typed rows the list queries
// return (only soundtrack_id/video_id are guaranteed present).
export function itemSummary(
  items: Pick<CollectionItem, "video_id">[] | undefined | null,
): string {
  const list = items ?? [];
  let albums = 0;
  let tracks = 0;
  for (const i of list) {
    if (i.video_id) tracks++;
    else albums++;
  }
  const parts: string[] = [];
  if (albums) parts.push(`${albums} album${albums !== 1 ? "s" : ""}`);
  if (tracks) parts.push(`${tracks} track${tracks !== 1 ? "s" : ""}`);
  return parts.length ? parts.join(" · ") : "0 items";
}
