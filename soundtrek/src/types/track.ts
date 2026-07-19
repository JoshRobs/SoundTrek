// A row of the tracks table — one entry in a soundtrack's YouTube playlist,
// snapshotted by scripts/sync-tracklists.ts.
export interface TracklistEntry {
  position: number;
  video_id: string;
  title: string;
  unavailable: boolean;
}
