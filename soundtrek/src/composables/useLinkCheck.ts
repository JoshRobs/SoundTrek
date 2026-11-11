import { ref, computed, watch } from "vue";

// Live checking for a soundtrack's YouTube playlist/video and Spotify IDs:
// resolves each to its title (plus video length / playlist size) so a wrong,
// private or deleted ID is obvious before saving, and builds the "Open ↗" and
// "Search ↗" links shown next to each field. Shared by the admin Add, Edit and
// Fix Links pages.

export interface Resolved {
  status: "empty" | "loading" | "ok" | "error";
  title?: string;
  error?: string;
}

export interface LinkCheckSource {
  playlistId: () => string;
  videoId: () => string;
  spotifyId: () => string;
  /** Blank falls back to "album", the type nearly every OST uses. */
  spotifyType: () => string;
  gameTitle: () => string;
}

const proxyUrl = import.meta.env.VITE_YOUTUBE_PROXY_URL as string | undefined;

// mm:ss (or h:mm:ss) from a YouTube contentDetails ISO 8601 duration like "PT4M13S"
function formatDuration(iso: string): string {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return iso;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  const parts =
    h > 0
      ? [h, String(min).padStart(2, "0"), String(s).padStart(2, "0")]
      : [min, String(s).padStart(2, "0")];
  return parts.join(":");
}

async function resolveSpotify(type: string, id: string): Promise<Resolved> {
  const endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(
    `https://open.spotify.com/${type}/${id}`,
  )}`;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      return { status: "error", error: `HTTP ${res.status} — broken, private, or deleted` };
    }
    const data = (await res.json()) as { title?: string };
    return data.title
      ? { status: "ok", title: data.title }
      : { status: "error", error: "No title in response" };
  } catch {
    return { status: "error", error: "Request failed" };
  }
}

// YouTube's oEmbed has no duration and no playlist support, so both go through
// the youtube-proxy worker, which holds the Data API key.
async function resolveVideo(id: string): Promise<Resolved> {
  if (!proxyUrl) return { status: "error", error: "VITE_YOUTUBE_PROXY_URL not configured" };
  try {
    const res = await fetch(`${proxyUrl}/video-info/${id}`);
    if (res.status === 404) return { status: "error", error: "Video not found — deleted or private" };
    if (!res.ok) return { status: "error", error: `Proxy error (HTTP ${res.status})` };
    const data = (await res.json()) as { title: string; duration?: string };
    return {
      status: "ok",
      title: `${data.title}${data.duration ? ` (${formatDuration(data.duration)})` : ""}`,
    };
  } catch {
    return { status: "error", error: "Proxy unreachable — is the worker running?" };
  }
}

async function resolvePlaylist(id: string): Promise<Resolved> {
  if (!proxyUrl) return { status: "error", error: "VITE_YOUTUBE_PROXY_URL not configured" };
  try {
    const res = await fetch(`${proxyUrl}/playlist-info/${id}`);
    if (res.status === 404) return { status: "error", error: "Playlist not found — deleted or private" };
    if (!res.ok) return { status: "error", error: `Proxy error (HTTP ${res.status})` };
    const data = (await res.json()) as { title: string; itemCount?: number };
    return {
      status: "ok",
      title: `${data.title}${data.itemCount != null ? ` (${data.itemCount} videos)` : ""}`,
    };
  } catch {
    return { status: "error", error: "Proxy unreachable — is the worker running?" };
  }
}

const EMPTY: Resolved = { status: "empty" };

/**
 * @param opts.auto  Re-check automatically (debounced) whenever an ID changes.
 *                   Off for pages that trigger checks themselves.
 */
export function useLinkCheck(src: LinkCheckSource, opts: { auto?: boolean } = {}) {
  const ids = computed(() => ({
    playlist: src.playlistId().trim(),
    video: src.videoId().trim(),
    spotify: src.spotifyId().trim(),
    spotifyType: src.spotifyType() || "album",
  }));

  const resolved = ref<{ playlist: Resolved; video: Resolved; spotify: Resolved }>({
    playlist: EMPTY,
    video: EMPTY,
    spotify: EMPTY,
  });

  let checkToken = 0;

  async function check() {
    const token = ++checkToken;
    const { playlist, video, spotify, spotifyType } = ids.value;

    resolved.value = {
      playlist: { status: playlist ? "loading" : "empty" },
      video: { status: video ? "loading" : "empty" },
      spotify: { status: spotify ? "loading" : "empty" },
    };

    const [plRes, vidRes, spRes] = await Promise.all([
      playlist ? resolvePlaylist(playlist) : EMPTY,
      video ? resolveVideo(video) : EMPTY,
      spotify ? resolveSpotify(spotifyType, spotify) : EMPTY,
    ]);

    if (token !== checkToken) return; // stale — fields changed again
    resolved.value = { playlist: plRes, video: vidRes, spotify: spRes };
  }

  if (opts.auto) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    watch(
      () => JSON.stringify(ids.value),
      () => {
        clearTimeout(timer);
        timer = setTimeout(check, 400);
      },
      { immediate: true },
    );
  }

  // External "Open ↗" links for whatever IDs are currently entered.
  const playlistUrl = computed(() =>
    ids.value.playlist ? `https://www.youtube.com/playlist?list=${ids.value.playlist}` : null,
  );
  const videoUrl = computed(() =>
    ids.value.video ? `https://www.youtube.com/watch?v=${ids.value.video}` : null,
  );
  const spotifyUrl = computed(() =>
    ids.value.spotify
      ? `https://open.spotify.com/${ids.value.spotifyType}/${ids.value.spotify}`
      : null,
  );

  // "Search ↗" links for the game — YouTube "sp" params filter results by type
  // (EgIQAw = playlists only, EgIQAQ = videos only).
  const searchQuery = computed(() => {
    const title = src.gameTitle().trim();
    return title ? encodeURIComponent(`${title} full soundtrack`) : "";
  });
  const playlistSearchUrl = computed(() =>
    searchQuery.value
      ? `https://www.youtube.com/results?search_query=${searchQuery.value}&sp=EgIQAw%3D%3D`
      : null,
  );
  const videoSearchUrl = computed(() =>
    searchQuery.value
      ? `https://www.youtube.com/results?search_query=${searchQuery.value}&sp=EgIQAQ%3D%3D`
      : null,
  );
  const spotifySearchUrl = computed(() =>
    searchQuery.value ? `https://open.spotify.com/search/${searchQuery.value}/albums` : null,
  );

  return {
    resolved,
    check,
    playlistUrl,
    videoUrl,
    spotifyUrl,
    playlistSearchUrl,
    videoSearchUrl,
    spotifySearchUrl,
  };
}
