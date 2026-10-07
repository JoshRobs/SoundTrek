// Spam videos that get injected into third-party OST playlists. The uploader
// flips them between private and public, so they sit "unavailable" (and get
// skipped) most of the time, then suddenly play mid-playlist. Filtered out of
// every playlist the worker serves and every queue/tracklist the client builds.
//
// Imported by the youtube-proxy worker too (workers/youtube-proxy/src/index.ts)
// — keep this file dependency-free.

// Individual video IDs. Needed even with the channel list below: while a video
// is private, playlistItems omits its uploader, so only the ID identifies it.
export const BLOCKED_VIDEO_IDS = new Set<string>([
  "J0vUqvfHQeQ", // "Unreleased" — 58 min crypto scam (channel "ahdukejk")
]);

// Uploader channel IDs — catches new videos from the same spammer.
export const BLOCKED_CHANNEL_IDS = new Set<string>([
  "UCYEUeTgPLy8MtY8iXja3AFQ", // "ahdukejk"
]);

export function isBlockedVideo(videoId: string, channelId?: string | null): boolean {
  return (
    BLOCKED_VIDEO_IDS.has(videoId) ||
    (!!channelId && BLOCKED_CHANNEL_IDS.has(channelId))
  );
}
