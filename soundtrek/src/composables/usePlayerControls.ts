import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import type { Ref } from "vue";
import { storeToRefs } from "pinia";
import { supabase } from "@/lib/supabase";
import type { Soundtrack } from "@/types/soundtrack";
import { usePlayerStore } from "@/stores/player";
import { cleanTracklistTitles } from "@/utils/trackTitle";

interface SpotifyEmbedControls {
  play: () => void;
  pause: () => void;
}

// Shape returned by the proxy's /playlist endpoint — QueueItem minus the
// soundtrack, which gets attached when the queue is built.
interface ProxyPlaylistItem {
  videoId: string;
  title: string;
  unavailable: boolean;
}

// ── YT IFrame API singleton loader ──────────────────────────────────────────
let ytApiReady = false;
const ytReadyCallbacks: (() => void)[] = [];

function loadYTApi(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiReady) {
      resolve();
      return;
    }
    ytReadyCallbacks.push(resolve);
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      ytApiReady = true;
      ytReadyCallbacks.forEach((cb) => cb());
      ytReadyCallbacks.length = 0;
    };
  });
}

export function usePlayerControls(
  nowPlaying: Ref<Soundtrack | null>,
  activeSource: Ref<"youtube" | "spotify">,
  ytContainerRef: Ref<HTMLElement | null>,
  spotifyEmbedRef: Ref<SpotifyEmbedControls | null>,
) {
  const isPlaying = ref(false);
  const volume = ref(
    !import.meta.env.SSR ? Number(localStorage.getItem("player-volume") || "100") : 100,
  );
  const muted = ref(false);
  // Custom queue: the full playlist fetched via the proxy (no 50-track cap).
  // When populated, playback is driven by loadVideoById instead of the
  // player's native list mode, so next/prev/playAt work past 50 tracks and
  // the queue can be appended to or reordered. The queue itself lives in the
  // player store so views outside the player can enqueue tracks; queueActive
  // (aliased here) also lives there because nowPlaying derivation needs it.
  const {
    queue,
    currentTrackIndex,
    playRequestId,
    isCustomQueue,
    queueActive: customQueueActive,
    pendingVideoId,
    seekRequestIndex,
    seekRequestSeq,
  } = storeToRefs(usePlayerStore());
  // Native list mode is kept only as a fallback when the proxy is unreachable.
  const nativePlaylistIds = ref<string[]>([]);
  const playerVideoIds = computed(() =>
    customQueueActive.value
      ? queue.value.map((i) => i.videoId)
      : nativePlaylistIds.value,
  );
  const ytPlaylistMode = ref(true);
  const ytFallbackNeeded = ref(false);
  let premuteVolume = volume.value;
  let player: YT.Player | null = null;
  let playerReady = false;
  let initId = 0;
  let recoveryTimer: ReturnType<typeof setTimeout> | null = null;

  function clearRecoveryTimer() {
    if (recoveryTimer) { clearTimeout(recoveryTimer); recoveryTimer = null; }
  }

  function destroyPlayer() {
    clearRecoveryTimer();
    playerReady = false;
    if (player) {
      try { player.destroy(); } catch {}
      player = null;
    }
  }

  // Prefers the synced, human-cleaned titles in the `tracks` table (same
  // source TracklistPanel reads). Falls back to a live proxy fetch + the
  // same cleanTracklistTitles pass SoundtrackView uses, for OSTs that
  // haven't been synced yet — never raw YouTube titles.
  async function fetchQueueItems(track: Soundtrack): Promise<ProxyPlaylistItem[]> {
    const playlistId = track.youtube_playlist_id;
    if (!playlistId) return [];

    const { data } = await supabase
      .from("tracks")
      .select("video_id, title, unavailable")
      .eq("soundtrack_id", track.id)
      .order("position");
    if (data?.length) {
      return data.map((d) => ({
        videoId: d.video_id,
        title: d.title,
        unavailable: d.unavailable,
      }));
    }

    const proxyUrl = import.meta.env.VITE_YOUTUBE_PROXY_URL;
    if (!proxyUrl) return [];
    try {
      const res = await fetch(`${proxyUrl}/playlist/${playlistId}`);
      if (!res.ok) return [];
      const items = (await res.json()) as ProxyPlaylistItem[];
      if (!Array.isArray(items)) return [];
      const titles = cleanTracklistTitles(
        items.map((it) => ({ title: it.title, unavailable: it.unavailable })),
        {
          gameTitle: track.game_title,
          composers: track.composers,
          studio: track.studio,
        },
      );
      return items.map((item, i) => ({ ...item, title: titles[i] }));
    } catch {
      return [];
    }
  }

  // Nearest playable queue index in the given direction, or -1 if none.
  function findAvailable(from: number, dir: 1 | -1, wrap: boolean): number {
    const q = queue.value;
    const n = q.length;
    if (!n) return -1;
    for (let step = 1; step < n; step++) {
      let i = from + dir * step;
      if (i < 0 || i >= n) {
        if (!wrap) return -1;
        i = ((i % n) + n) % n;
      }
      if (!q[i].unavailable) return i;
    }
    return -1;
  }

  // The proxy flags deleted/private videos, but its cache can be stale and
  // embedding-disabled videos (101/150) only surface as player errors — mark
  // the item and move on.
  function skipUnavailableCurrent() {
    const item = queue.value[currentTrackIndex.value];
    if (item) item.unavailable = true;
    const next = findAvailable(currentTrackIndex.value, 1, true);
    if (next === -1) {
      ytFallbackNeeded.value = true;
      return;
    }
    playTrackAt(next);
  }

  function createPlayer(videoId: string | null, playlistId: string | null) {
    if (!ytContainerRef.value) return;
    destroyPlayer();

    const div = document.createElement("div");
    ytContainerRef.value.innerHTML = "";
    ytContainerRef.value.appendChild(div);

    player = new window.YT.Player(div, {
      width: "100%",
      height: "100%",
      ...(videoId ? { videoId } : {}),
      playerVars: {
        autoplay: 1,
        rel: 0,
        ...(playlistId ? { list: playlistId, listType: "playlist" } : {}),
      },
      // Cast to any: onError exists in the YT API but is missing from the type definitions
      events: {
        onReady: () => {
          playerReady = true;
          player?.setVolume(muted.value ? 0 : volume.value);
          if (customQueueActive.value) {
            // Player is created empty in queue mode — load whatever the
            // current index is now, so a resume-from-storage playTrackAt
            // that landed during init wins over track one.
            const item = queue.value[currentTrackIndex.value];
            if (item) player?.loadVideoById(item.videoId);
          } else {
            nativePlaylistIds.value = (player as any)?.getPlaylist() ?? [];
          }
        },
        onStateChange: (e: { data: number }) => {
          isPlaying.value = e.data === 1;
          if (e.data === 1 || e.data === 2) {
            if (!customQueueActive.value) {
              currentTrackIndex.value = player?.getPlaylistIndex() ?? 0;
            }
            clearRecoveryTimer();
          }
          if (e.data === 0) {
            if (customQueueActive.value) {
              // Queue mode: advance when a track ends; stop after the last
              // one (no wrap), matching native playlist behavior.
              const next = findAvailable(currentTrackIndex.value, 1, false);
              if (next !== -1) playTrackAt(next);
            } else if (
              !playlistId &&
              isCustomQueue.value &&
              queue.value.length > 0
            ) {
              // A single video finished while user-enqueued tracks were
              // waiting — hand playback off to the queue.
              customQueueActive.value = true;
              playTrackAt(0);
            }
          }
        },
        onError: (e: { data: number }) => {
          // 100 = not found/private, 101/150 = embedding disabled
          if (![100, 101, 150].includes(e.data)) return;
          if (customQueueActive.value) {
            skipUnavailableCurrent();
          } else if (playlistId) {
            // Give the player 2.5s to auto-skip to a working video
            clearRecoveryTimer();
            recoveryTimer = setTimeout(() => {
              if (!isPlaying.value) ytFallbackNeeded.value = true;
            }, 2500);
          } else {
            ytFallbackNeeded.value = true;
          }
        },
      } as any,
    });
  }

  async function initPlayer() {
    clearRecoveryTimer();
    ytFallbackNeeded.value = false;
    const myId = ++initId;
    const track = nowPlaying.value;
    const source = activeSource.value;
    if (source !== "youtube" || !track) {
      destroyPlayer();
      return;
    }
    // Stop the old video right away — the queue fetch below can take a moment
    destroyPlayer();

    if (isCustomQueue.value && queue.value.length > 0) {
      // User-built queue — play it as-is, no playlist fetch. Resume at the
      // current index (clamped, in case a persisted index went stale).
      let start = Math.min(
        Math.max(currentTrackIndex.value, 0),
        queue.value.length - 1,
      );
      if (queue.value[start].unavailable) {
        const alt = findAvailable(start, 1, true);
        if (alt === -1) {
          ytFallbackNeeded.value = true;
          return;
        }
        start = alt;
      }
      currentTrackIndex.value = start;
      customQueueActive.value = true;
    } else if (ytPlaylistMode.value && track.youtube_playlist_id) {
      const items = await fetchQueueItems(track);
      if (myId !== initId) return;
      if (items.length > 0) {
        const ostItems = items.map((i) => ({ ...i, soundtrack: track }));
        // Tracks enqueued while the fetch was in flight belong after the OST
        queue.value =
          isCustomQueue.value && queue.value.length > 0
            ? [...ostItems, ...queue.value]
            : ostItems;
        customQueueActive.value = true;
        // If a specific start video was requested (via playFromTrack), seek to
        // it; otherwise start at the first available track.
        let start = -1;
        if (pendingVideoId.value) {
          start = queue.value.findIndex(
            (i) => i.videoId === pendingVideoId.value && !i.unavailable,
          );
          pendingVideoId.value = null;
        }
        if (start === -1) start = queue.value.findIndex((i) => !i.unavailable);
        if (start === -1) {
          // Every video in the queue is dead — let the UI fall back
          ytFallbackNeeded.value = true;
          return;
        }
        currentTrackIndex.value = start;
      }
    }

    await loadYTApi();
    await nextTick();
    if (myId !== initId) return;
    if (customQueueActive.value) {
      // No videoId and no list: onReady loads the current queue item
      createPlayer(null, null);
    } else {
      createPlayer(
        track.youtube_video_id,
        ytPlaylistMode.value && track.youtube_playlist_id
          ? track.youtube_playlist_id
          : null,
      );
    }
  }

  function applyVolume() {
    player?.setVolume(muted.value ? 0 : volume.value);
  }

  function toggleMute() {
    if (muted.value) {
      muted.value = false;
      volume.value = premuteVolume || 100;
    } else {
      premuteVolume = volume.value;
      muted.value = true;
    }
    applyVolume();
  }

  function togglePlay() {
    if (activeSource.value === "youtube") {
      if (isPlaying.value) {
        player?.pauseVideo();
        isPlaying.value = false;
      } else {
        player?.playVideo();
        isPlaying.value = true;
      }
    } else {
      if (isPlaying.value) spotifyEmbedRef.value?.pause();
      else spotifyEmbedRef.value?.play();
    }
  }

  function nextTrack() {
    if (!customQueueActive.value) {
      player?.nextVideo();
      return;
    }
    const next = findAvailable(currentTrackIndex.value, 1, true);
    if (next !== -1) playTrackAt(next);
  }

  function prevTrack() {
    if (!customQueueActive.value) {
      player?.previousVideo();
      return;
    }
    const prev = findAvailable(currentTrackIndex.value, -1, false);
    if (prev !== -1) playTrackAt(prev);
    else player?.seekTo(0, true); // on the first track — restart it, like YT does
  }

  function playTrackAt(index: number) {
    if (!customQueueActive.value) {
      player?.playVideoAt(index);
      currentTrackIndex.value = index;
      return;
    }
    const item = queue.value[index];
    if (!item) return;
    if (item.unavailable) {
      const next = findAvailable(index, 1, true);
      if (next !== -1) playTrackAt(next);
      return;
    }
    currentTrackIndex.value = index;
    // Not ready yet? onReady loads the current index — nothing to do here
    if (playerReady) player?.loadVideoById(item.videoId);
  }

  function setSpotifyPlaying(isPaused: boolean) {
    if (activeSource.value === "spotify") isPlaying.value = !isPaused;
  }

  // ── Media Session API ─────────────────────────────────────────────────────
  function updateMediaSession() {
    if (import.meta.env.SSR || !("mediaSession" in navigator)) return;
    const track = nowPlaying.value;
    if (!track) {
      navigator.mediaSession.playbackState = "none";
      return;
    }
    // With an active queue, surface the individual track; the game becomes
    // the album so lock screens show "track — composer — game".
    const item = customQueueActive.value
      ? queue.value[currentTrackIndex.value]
      : undefined;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item?.title || track.game_title,
      artist: (track.composers ?? []).join(", ") || track.studio || "",
      album: item ? track.game_title : "SoundTrek",
      artwork: track.cover_image_url
        ? [{ src: track.cover_image_url, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });
    navigator.mediaSession.playbackState = isPlaying.value ? "playing" : "paused";
  }

  function setupMediaSessionHandlers() {
    if (import.meta.env.SSR || !("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => {
      if (activeSource.value === "youtube") player?.playVideo();
      else spotifyEmbedRef.value?.play();
      isPlaying.value = true;
      updateMediaSession();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      if (activeSource.value === "youtube") player?.pauseVideo();
      else spotifyEmbedRef.value?.pause();
      isPlaying.value = false;
      updateMediaSession();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack());
    navigator.mediaSession.setActionHandler("previoustrack", () => prevTrack());
  }

  watch(nowPlaying, updateMediaSession);
  watch(isPlaying, updateMediaSession);
  watch(currentTrackIndex, updateMediaSession);

  watch(volume, (v) => {
    if (import.meta.env.SSR) return;
    localStorage.setItem("player-volume", String(v));
    if (muted.value && v > 0) muted.value = false;
    applyVolume();
  });

  // Resets how the player is being driven, but not the queue itself — the
  // store owns queue clearing (playSoundtrack), so user-built queues survive
  // source switches and player re-inits.
  function resetPlaybackState() {
    isPlaying.value = false;
    customQueueActive.value = false;
    nativePlaylistIds.value = [];
  }

  function setYtPlaylistMode(mode: boolean) {
    ytPlaylistMode.value = mode;
    resetPlaybackState();
    if (!isCustomQueue.value) {
      queue.value = [];
      currentTrackIndex.value = 0;
    }
    initPlayer();
  }

  // seekToQueueIndex bumps this to jump to a queue position without a full
  // player reinit. customQueueActive is already true when this fires.
  watch(seekRequestSeq, () => {
    playTrackAt(seekRequestIndex.value);
  });

  // playRequestId, not nowPlaying, drives re-init: nowPlaying is derived from
  // the current queue item, so advancing through a mixed queue changes it
  // without needing to tear the player down.
  watch([playRequestId, activeSource], () => {
    resetPlaybackState();
    ytPlaylistMode.value = true;
    initPlayer();
  });

  onMounted(() => {
    initPlayer();
    setupMediaSessionHandlers();
  });
  onUnmounted(destroyPlayer);

  return {
    isPlaying,
    volume,
    muted,
    currentTrackIndex,
    queue,
    playerVideoIds,
    toggleMute,
    togglePlay,
    nextTrack,
    prevTrack,
    playTrackAt,
    setSpotifyPlaying,
    ytPlaylistMode,
    setYtPlaylistMode,
    ytFallbackNeeded,
  };
}
