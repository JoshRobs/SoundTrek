import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import type { Ref } from "vue";
import type { Soundtrack } from "@/types/soundtrack";

interface SpotifyEmbedControls {
  play: () => void;
  pause: () => void;
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
  const currentTrackIndex = ref(0);
  const playerVideoIds = ref<string[]>([]);
  const ytPlaylistMode = ref(true);
  let premuteVolume = volume.value;
  let player: YT.Player | null = null;
  let initId = 0;

  function destroyPlayer() {
    if (player) {
      try {
        player.destroy();
      } catch {}
      player = null;
    }
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
      events: {
        onReady: () => {
          player?.setVolume(muted.value ? 0 : volume.value);
          playerVideoIds.value = (player as any)?.getPlaylist() ?? [];
        },
        onStateChange: (e) => {
          isPlaying.value = e.data === 1;
          if (e.data === 1 || e.data === 2) {
            currentTrackIndex.value = player?.getPlaylistIndex() ?? 0;
          }
        },
      },
    });
  }

  async function initPlayer() {
    const myId = ++initId;
    const track = nowPlaying.value;
    const source = activeSource.value;
    if (source !== "youtube" || !track) {
      destroyPlayer();
      return;
    }
    await loadYTApi();
    await nextTick();
    if (myId !== initId) return;
    const usePlaylist = ytPlaylistMode.value && !!track.youtube_playlist_id;
    createPlayer(track.youtube_video_id, usePlaylist ? track.youtube_playlist_id : null);
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
    player?.nextVideo();
  }

  function prevTrack() {
    player?.previousVideo();
  }

  function playTrackAt(index: number) {
    player?.playVideoAt(index);
    currentTrackIndex.value = index;
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
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.game_title,
      artist: (track.composers ?? []).join(", ") || track.studio || "",
      album: "SoundTrek",
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

  watch(volume, (v) => {
    if (import.meta.env.SSR) return;
    localStorage.setItem("player-volume", String(v));
    if (muted.value && v > 0) muted.value = false;
    applyVolume();
  });

  function setYtPlaylistMode(mode: boolean) {
    ytPlaylistMode.value = mode;
    isPlaying.value = false;
    currentTrackIndex.value = 0;
    playerVideoIds.value = [];
    initPlayer();
  }

  watch([nowPlaying, activeSource], () => {
    isPlaying.value = false;
    currentTrackIndex.value = 0;
    playerVideoIds.value = [];
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
    playerVideoIds,
    toggleMute,
    togglePlay,
    nextTrack,
    prevTrack,
    playTrackAt,
    setSpotifyPlaying,
    ytPlaylistMode,
    setYtPlaylistMode,
  };
}
