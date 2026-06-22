<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import StreamingLinks from "./StreamingLinks.vue";
import { usePlayerControls } from "@/composables/usePlayerControls";
import SpotifyEmbed from "./SpotifyEmbed.vue";

const router = useRouter();

const store = useSoundtrackStore();
const { nowPlaying } = storeToRefs(store);

const minimized = ref(false);
const activeSource = ref<"youtube" | "spotify">("youtube");
const width = ref(320);
const height = ref(180);

const MIN_WIDTH = 240;
const MAX_WIDTH = 800;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 700;

const hasYoutube = computed(
  () =>
    !!(
      nowPlaying.value?.youtube_video_id ||
      nowPlaying.value?.youtube_playlist_id
    ),
);
const hasSpotify = computed(
  () => !!(nowPlaying.value?.spotify_id && nowPlaying.value?.spotify_type),
);
const hasBoth = computed(() => hasYoutube.value && hasSpotify.value);

// ── Playlist side panel ─────────────────────────────────────────────────────
interface PlaylistItem { videoId: string; title: string; unavailable: boolean }
const playlistItems = ref<PlaylistItem[]>([]);
const showPanel = computed(
  () => playlistItems.value.length > 0 && activeSource.value === "youtube",
);
const PANEL_WIDTH = 220;
const displayWidth = computed(() => {
  if (minimized.value) return 400;
  return width.value + (showPanel.value ? PANEL_WIDTH : 0);
});

function applySourceDefaults(source: "youtube" | "spotify") {
  if (source === "spotify") {
    width.value = MAX_WIDTH;
    height.value = 352;
  } else if (nowPlaying.value?.source_type === "playlist") {
    width.value = 480;
    height.value = 270;
  } else {
    width.value = 320;
    height.value = 180;
  }
}

function switchSource(source: "youtube" | "spotify") {
  activeSource.value = source;
}

// ── Persistence ────────────────────────────────────────────────────────────
let skipNextReset = false;

watch(nowPlaying, (s) => {
  if (s) localStorage.setItem("player-track", JSON.stringify(s));
  else localStorage.removeItem("player-track");
});

watch(activeSource, (src) => localStorage.setItem("player-source", src));
watch([width, height], ([w, h]) => {
  localStorage.setItem("player-width", String(w));
  localStorage.setItem("player-height", String(h));
});

watch(nowPlaying, (s) => {
  if (!s) return;
  if (skipNextReset) {
    skipNextReset = false;
    return;
  }
  minimized.value = false;
  const preferSpotify = !!(s.spotify_id && s.spotify_type);
  activeSource.value = preferSpotify ? "spotify" : "youtube";
  applySourceDefaults(activeSource.value);
});

onMounted(() => {
  const raw = localStorage.getItem("player-track");
  if (!raw) return;
  try {
    const track = JSON.parse(raw);
    const src = (localStorage.getItem("player-source") ?? "youtube") as
      | "youtube"
      | "spotify";
    const w = Number(localStorage.getItem("player-width")) || 320;
    const h = Number(localStorage.getItem("player-height")) || 180;
    pendingVideoId.value = localStorage.getItem("player-video-id");
    skipNextReset = true;
    store.setNowPlaying(track);
    activeSource.value = src;
    width.value = w;
    height.value = h;
  } catch {
    localStorage.removeItem("player-track");
  }
});

// ── Drag to move ───────────────────────────────────────────────────────────
const playerRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
// Store as right/bottom so the resize anchor stays at the bottom-right corner
const dragPos = ref<{ right: number; bottom: number } | null>(null);
let moveOffsetX = 0;
let moveOffsetY = 0;

function onMoveStart(e: MouseEvent) {
  if ((e.target as HTMLElement).closest("button, a, input")) return;
  if (!playerRef.value) return;
  e.preventDefault();
  const rect = playerRef.value.getBoundingClientRect();
  moveOffsetX = e.clientX - rect.left;
  moveOffsetY = e.clientY - rect.top;
  isDragging.value = true;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "grabbing";
  window.addEventListener("mousemove", onMoveMove);
  window.addEventListener("mouseup", onMoveEnd);
}

function onMoveMove(e: MouseEvent) {
  if (!playerRef.value) return;
  const w = playerRef.value.offsetWidth;
  const h = playerRef.value.offsetHeight;
  const left = Math.max(0, Math.min(window.innerWidth - w, e.clientX - moveOffsetX));
  const top = Math.max(0, Math.min(window.innerHeight - h, e.clientY - moveOffsetY));
  dragPos.value = {
    right: window.innerWidth - left - w,
    bottom: window.innerHeight - top - h,
  };
}

function onMoveEnd() {
  isDragging.value = false;
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
  window.removeEventListener("mousemove", onMoveMove);
  window.removeEventListener("mouseup", onMoveEnd);
}

function clampToViewport() {
  if (!playerRef.value) return;
  const rect = playerRef.value.getBoundingClientRect();
  const overLeft = rect.left;   // negative means off left edge
  const overTop  = rect.top;    // negative means off top edge
  if (overLeft >= 0 && overTop >= 0) return;
  dragPos.value = {
    right:  Math.max(0, (dragPos.value?.right  ?? 0) + Math.min(0, overLeft)),
    bottom: Math.max(0, (dragPos.value?.bottom ?? 0) + Math.min(0, overTop)),
  };
}

watch(minimized, async (isMin) => {
  if (isMin) return;
  await nextTick();
  clampToViewport();
});

// ── Resize ─────────────────────────────────────────────────────────────────
let dragStartX = 0,
  dragStartY = 0,
  dragStartWidth = 0,
  dragStartHeight = 0;

function onResizeStart(e: MouseEvent) {
  e.preventDefault();
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartWidth = width.value;
  dragStartHeight = height.value;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "nwse-resize";
  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", onResizeEnd);
}

function onResizeMove(e: MouseEvent) {
  width.value = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, dragStartWidth + (dragStartX - e.clientX)),
  );
  height.value = Math.min(
    MAX_HEIGHT,
    Math.max(MIN_HEIGHT, dragStartHeight + (dragStartY - e.clientY)),
  );
}

function onResizeEnd() {
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", onResizeEnd);
}

// ── Spotify hint ───────────────────────────────────────────────────────────
const spotifyHintDismissed = ref(false);
function dismissSpotifyHint() {
  spotifyHintDismissed.value = true;
}

// ── Playback controls ──────────────────────────────────────────────────────
const ytContainerRef = ref<HTMLElement | null>(null);
const spotifyEmbedRef = ref<InstanceType<typeof SpotifyEmbed> | null>(null);
const {
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
} = usePlayerControls(nowPlaying, activeSource, ytContainerRef, spotifyEmbedRef);

function playVideoById(videoId: string) {
  const idx = playerVideoIds.value.indexOf(videoId);
  if (idx !== -1) playTrackAt(idx);
}

// ── Playlist resume across refreshes ───────────────────────────────────────
const pendingVideoId = ref<string | null>(null);

watch([currentTrackIndex, playerVideoIds], () => {
  const ids = playerVideoIds.value;
  const vid = ids[currentTrackIndex.value];
  if (vid && nowPlaying.value?.youtube_playlist_id) {
    localStorage.setItem("player-video-id", vid);
  }
});

watch(playerVideoIds, (ids) => {
  if (!pendingVideoId.value || ids.length === 0) return;
  const idx = ids.indexOf(pendingVideoId.value);
  if (idx > 0) playTrackAt(idx);
  pendingVideoId.value = null;
});

// ── Playlist items fetch ────────────────────────────────────────────────────
watch(
  nowPlaying,
  async (track) => {
    playlistItems.value = [];
    if (!track?.youtube_playlist_id) return;
    const key = (import.meta.env.VITE_YOUTUBE_API_KEY ?? "") as string;
    if (!key) return;
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${track.youtube_playlist_id}&maxResults=50&key=${key}`,
      );
      const data = await res.json();
      playlistItems.value = (data.items ?? []).map((item: any) => {
        const title = item.snippet.title as string;
        const unavailable = title === "Deleted video" || title === "Private video";
        return { videoId: item.snippet.resourceId.videoId, title, unavailable };
      });
    } catch {}
  },
  { immediate: true },
);

const hasSource = computed(
  () =>
    (activeSource.value === "youtube" && hasYoutube.value) ||
    (activeSource.value === "spotify" && hasSpotify.value),
);

onUnmounted(() => {
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", onResizeEnd);
  window.removeEventListener("mousemove", onMoveMove);
  window.removeEventListener("mouseup", onMoveEnd);
  document.removeEventListener("click", hideContextMenu);
  document.removeEventListener("keydown", onContextMenuKey);
});

// ── Context menu ───────────────────────────────────────────────────────────
const contextMenu = ref<{ x: number; y: number } | null>(null);
const linkCopied = ref(false);

function showContextMenu(e: MouseEvent) {
  e.preventDefault();
  const MENU_W = 210;
  const MENU_H = 220;
  const x = Math.min(e.clientX, window.innerWidth - MENU_W - 8);
  const y = Math.min(e.clientY, window.innerHeight - MENU_H - 8);
  contextMenu.value = { x, y };
  document.addEventListener("click", hideContextMenu, { once: true });
  document.addEventListener("keydown", onContextMenuKey);
}

function hideContextMenu() {
  contextMenu.value = null;
  document.removeEventListener("keydown", onContextMenuKey);
}

function onContextMenuKey(e: KeyboardEvent) {
  if (e.key === "Escape") hideContextMenu();
}

function goToSoundtrackPage() {
  if (nowPlaying.value) router.push(`/soundtrack/${nowPlaying.value.id}`);
  hideContextMenu();
}

async function copyLink() {
  if (!nowPlaying.value) return;
  await navigator.clipboard.writeText(
    `${window.location.origin}/soundtrack/${nowPlaying.value.id}`
  );
  linkCopied.value = true;
  setTimeout(() => (linkCopied.value = false), 2000);
  hideContextMenu();
}

function ctxMinimize() {
  minimized.value = !minimized.value;
  hideContextMenu();
}

function ctxClose() {
  store.setNowPlaying(null);
  hideContextMenu();
}

function ctxSwitchSource(src: "youtube" | "spotify") {
  switchSource(src);
  hideContextMenu();
}
</script>

<template>
  <div
    v-if="nowPlaying"
    ref="playerRef"
    class="player-widget"
    :class="{ minimized }"
    :style="{
      width: displayWidth + 'px',
      ...(dragPos ? { right: dragPos.right + 'px', bottom: dragPos.bottom + 'px' } : {}),
    }"
    @contextmenu.prevent="showContextMenu"
  >
    <!-- Drag shield — blocks iframe from swallowing mouseup during drag -->
    <div v-if="isDragging" class="drag-shield" />

    <!-- Resize handle — top-left corner -->
    <div v-show="!minimized" class="resize-handle" @mousedown="onResizeStart">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <line
          x1="1"
          y1="9"
          x2="9"
          y2="1"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <line
          x1="1"
          y1="5"
          x2="5"
          y2="1"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <!-- Header -->
    <div class="player-header" @mousedown="onMoveStart">
      <div class="player-title-group">
        <span class="player-game">{{ nowPlaying.game_title }}</span>
        <span class="player-composer">{{ nowPlaying.composer }}</span>
      </div>
      <div v-if="minimized && hasSource" class="center-controls">
        <button
          v-if="nowPlaying.source_type === 'playlist'"
          class="track-nav-btn"
          aria-label="Previous track"
          @click="prevTrack"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
        </button>
        <button
          class="play-btn-large"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          @click="togglePlay"
        >
          <svg
            v-if="isPlaying"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
          <svg
            v-else
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            style="padding-left: 2px"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <button
          v-if="nowPlaying.source_type === 'playlist'"
          class="track-nav-btn"
          aria-label="Next track"
          @click="nextTrack"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" />
          </svg>
        </button>
      </div>
      <div class="player-actions">
        <div v-if="activeSource === 'youtube'" class="volume-control">
          <button
            class="action-btn"
            :aria-label="muted ? 'Unmute' : 'Mute'"
            @click="toggleMute"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path
                v-if="muted"
                d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25A6.97 6.97 0 0 1 14 18.98v2.06A8.99 8.99 0 0 0 17.73 19L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"
              />
              <path
                v-else-if="volume < 50"
                d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"
              />
              <path
                v-else
                d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
              />
            </svg>
          </button>
          <div class="volume-popup">
            <input
              v-model.number="volume"
              type="range"
              min="0"
              max="100"
              class="volume-slider"
              aria-label="Volume"
            />
          </div>
        </div>
        <button
          class="action-btn"
          :aria-label="minimized ? 'Expand player' : 'Minimize player'"
          @click="minimized = !minimized"
        >
          <svg
            v-if="minimized"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
          <svg
            v-else
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button
          class="action-btn"
          aria-label="Close player"
          @click="store.setNowPlaying(null)"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Source switcher — only when both are available -->
    <div v-if="hasBoth && !minimized" class="source-bar">
      <button
        class="source-btn"
        :class="{ active: activeSource === 'youtube' }"
        @click="switchSource('youtube')"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"
          />
        </svg>
        YouTube
      </button>
      <button
        class="source-btn"
        :class="{ active: activeSource === 'spotify' }"
        @click="switchSource('spotify')"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
          />
        </svg>
        Spotify
      </button>
    </div>

    <!-- Player body — v-show keeps the player alive when minimized -->
    <div v-show="!minimized" class="player-body">
      <!-- Side-by-side: playlist panel (left) + embed (right) -->
      <div v-if="hasSource" class="player-content">
        <!-- Scrollable track list — left of embed -->
        <div
          v-if="showPanel"
          class="playlist-panel"
          :style="{ height: height + 'px' }"
        >
          <button
            v-for="(item, i) in playlistItems"
            :key="item.videoId"
            class="playlist-track"
            :class="{ active: playerVideoIds[currentTrackIndex] === item.videoId, unavailable: item.unavailable }"
            :disabled="item.unavailable"
            @click="!item.unavailable && playVideoById(item.videoId)"
          >
            <span class="track-num">{{ i + 1 }}</span>
            <span class="track-title">{{ item.title }}</span>
          </button>
        </div>
        <div
          class="embed-wrap"
          :style="{ width: width + 'px', height: height + 'px' }"
        >
          <!-- YouTube container (managed by YT.Player API) -->
          <div
            v-if="activeSource === 'youtube' && hasYoutube"
            ref="ytContainerRef"
            class="yt-container"
          />
          <!-- Spotify — isolated component owns its own DOM -->
          <SpotifyEmbed
            v-if="activeSource === 'spotify' && hasSpotify"
            ref="spotifyEmbedRef"
            :spotify-type="nowPlaying.spotify_type!"
            :spotify-id="nowPlaying.spotify_id!"
            @playback-update="setSpotifyPlaying"
          />
        </div>
      </div>
      <div v-else class="no-source">
        <p class="no-source-text">No embeddable source available.</p>
        <StreamingLinks :links="nowPlaying.streaming_links ?? []" />
      </div>

      <div
        v-if="nowPlaying.source_type === 'playlist' && hasSource && !showPanel"
        class="playlist-nav"
      >
        <button
          class="playlist-nav-btn"
          aria-label="Previous track"
          @click="prevTrack"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
          Prev
        </button>
        <button
          class="playlist-nav-btn"
          aria-label="Next track"
          @click="nextTrack"
        >
          Next
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" />
          </svg>
        </button>
      </div>

      <!-- Spotify login hint — only shown when Spotify embed is active -->
      <div
        v-if="activeSource === 'spotify' && hasSpotify && !spotifyHintDismissed"
        class="spotify-hint"
      >
        <span>Only getting previews?</span>
        <a
          href="https://accounts.spotify.com/login"
          target="_blank"
          rel="noopener noreferrer"
          class="hint-link"
          >Sign in to Spotify</a
        >
        <span class="hint-sep">·</span>
        <button class="hint-reload" @click="spotifyEmbedRef?.reload()">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Refresh
        </button>
        <button
          class="hint-dismiss"
          aria-label="Dismiss"
          @click="dismissSpotifyHint"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="player-meta">
        <span class="meta-console">{{ nowPlaying.console }}</span>
        <span class="meta-dot">·</span>
        <span class="meta-year">{{ nowPlaying.release_year }}</span>
        <template v-if="nowPlaying.source_type === 'playlist'">
          <span class="meta-dot">·</span>
          <span class="meta-playlist">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Playlist
          </span>
        </template>
      </div>
    </div>
  </div>

  <!-- Context menu -->
  <Teleport to="body">
    <div
      v-if="contextMenu"
      class="ctx-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <button class="ctx-item" @click="ctxMinimize">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path v-if="minimized" d="M18 15l-6-6-6 6" />
          <path v-else d="M6 9l6 6 6-6" />
        </svg>
        {{ minimized ? 'Expand' : 'Minimize' }}
      </button>
      <button class="ctx-item" @click="ctxClose">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
        Close player
      </button>

      <div class="ctx-sep" />

      <button class="ctx-item" @click="goToSoundtrackPage">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        Go to soundtrack page
      </button>
      <button class="ctx-item" @click="copyLink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path v-if="linkCopied" d="M20 6 9 17l-5-5" />
          <template v-else>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </template>
        </svg>
        {{ linkCopied ? 'Copied!' : 'Copy link' }}
      </button>

      <template v-if="hasBoth">
        <div class="ctx-sep" />
        <button
          class="ctx-item"
          :class="{ 'ctx-item--active-yt': activeSource === 'youtube' }"
          :disabled="activeSource === 'youtube'"
          @click="ctxSwitchSource('youtube')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
          </svg>
          Switch to YouTube
        </button>
        <button
          class="ctx-item"
          :class="{ 'ctx-item--active-sp': activeSource === 'spotify' }"
          :disabled="activeSource === 'spotify'"
          @click="ctxSwitchSource('spotify')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Switch to Spotify
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.player-widget {
  position: fixed;
  bottom: 0.5rem;
  right: 1.5rem;
  background: #111;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8);
  z-index: 200;
}

.drag-shield {
  position: absolute;
  inset: 0;
  z-index: 999;
}

.resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: nwse-resize;
  color: rgba(255, 255, 255, 0.2);
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 1;
}

.player-widget:hover .resize-handle {
  opacity: 1;
}

.resize-handle:hover {
  color: rgba(255, 255, 255, 0.5);
}

.player-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  background: #0d0d0d;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px 8px 0 0;
  cursor: grab;
}

.player-header:active {
  cursor: grabbing;
}

.player-title-group {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.player-game {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-composer {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-actions {
  display: flex;
  gap: 0.1rem;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.85);
}

.source-bar {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: #0d0d0d;
}

.source-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.45rem 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}

.source-btn:hover {
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.04);
}

.source-btn:first-child.active {
  border-bottom-color: #ff3333;
  color: #ff3333;
}

.source-btn:last-child.active {
  border-bottom-color: #1db954;
  color: #1db954;
}

.player-body {
  display: flex;
  flex-direction: column;
}

.player-content {
  display: flex;
  flex-direction: row;
}

.embed-wrap {
  overflow: hidden;
  background: #000;
  flex-shrink: 0;
}

.yt-container {
  width: 100%;
  height: 100%;
}

.yt-container iframe {
  display: block;
  border: none;
}

.playlist-panel {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: #111;
  overflow-y: auto;
  scrollbar-width: none;
}

.playlist-panel::-webkit-scrollbar {
  display: none;
}

.playlist-track {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.42rem 0.75rem;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
}

.playlist-track:hover {
  background: rgba(255, 255, 255, 0.04);
}

.playlist-track.active {
  background: rgba(255, 255, 255, 0.07);
}

.track-num {
  flex-shrink: 0;
  width: 1.4rem;
  text-align: right;
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.2);
  font-variant-numeric: tabular-nums;
}

.playlist-track.active .track-num {
  color: rgba(255, 255, 255, 0.45);
}

.track-title {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.38);
  line-height: 1.3;
  word-break: break-word;
}

.playlist-track.active .track-title {
  color: rgba(255, 255, 255, 0.88);
  font-weight: 500;
}

.playlist-track.unavailable {
  cursor: default;
  opacity: 0.3;
}

.playlist-track.unavailable .track-title {
  text-decoration: line-through;
}

.no-source {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.no-source-text {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.35);
}

.spotify-hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.75rem;
  background: rgba(29, 185, 84, 0.06);
  border-top: 1px solid rgba(29, 185, 84, 0.15);
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.35);
  flex-wrap: wrap;
}

.hint-link {
  color: #1db954;
  text-decoration: none;
  font-weight: 500;
  white-space: nowrap;
}

.hint-link:hover {
  text-decoration: underline;
}

.hint-sep {
  color: rgba(255, 255, 255, 0.15);
}

.hint-reload {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.hint-reload:hover {
  color: rgba(255, 255, 255, 0.75);
}

.hint-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  padding: 0;
  margin-left: auto;
  transition: color 0.15s;
}

.hint-dismiss:hover {
  color: rgba(255, 255, 255, 0.7);
}

.player-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.meta-dot {
  color: rgba(255, 255, 255, 0.12);
}

.meta-playlist {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.volume-control {
  position: relative;
}

.volume-popup {
  position: absolute;
  bottom: calc(100%);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 0.5rem;
  background: #0d0d0d;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s;
  z-index: 10;
}

.volume-control:hover .volume-popup {
  opacity: 1;
  pointer-events: all;
}

.volume-slider {
  writing-mode: vertical-lr;
  direction: rtl;
  -webkit-appearance: slider-vertical;
  appearance: slider-vertical;
  width: 4px;
  height: 80px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 99px;
  outline: none;
  cursor: pointer;
  accent-color: #fff;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  transition: transform 0.1s;
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.3);
}

.volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: none;
  background: #fff;
  cursor: pointer;
}

.track-nav-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}

.track-nav-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.playlist-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: #0d0d0d;
}

.playlist-nav-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.75rem;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.playlist-nav-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.8);
}

.minimized .player-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  border-radius: 8px;
}

.minimized .player-actions {
  justify-self: end;
}

.center-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.play-btn-large {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.12s;
  flex-shrink: 0;
}

.play-btn-large:hover {
  background: rgba(255, 255, 255, 0.18);
}

.play-btn-large:active {
  transform: scale(0.92);
}

/* ── Context menu ─────────────────────────────────────────────────────────── */
</style>

<style>
.ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 210px;
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  animation: ctx-in 0.1s ease-out;
}

@keyframes ctx-in {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.82rem;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.ctx-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.95);
}

.ctx-item:disabled {
  opacity: 0.35;
  cursor: default;
}

.ctx-item--active-yt { color: #ff3333; }
.ctx-item--active-sp { color: #1db954; }

.ctx-sep {
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
  margin: 3px 0;
}
</style>

