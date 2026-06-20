<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import StreamingLinks from "./StreamingLinks.vue";
import { usePlayerControls } from "@/composables/usePlayerControls";
import SpotifyEmbed from "./SpotifyEmbed.vue";

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
const displayWidth = computed(() => (minimized.value ? 400 : width.value));

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
    skipNextReset = true;
    store.setNowPlaying(track);
    activeSource.value = src;
    width.value = w;
    height.value = h;
  } catch {
    localStorage.removeItem("player-track");
  }
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
const iframeRef = ref<HTMLIFrameElement | null>(null);
const spotifyEmbedRef = ref<InstanceType<typeof SpotifyEmbed> | null>(null);
const {
  isPlaying,
  volume,
  muted,
  toggleMute,
  togglePlay,
  nextTrack,
  prevTrack,
  setSpotifyPlaying,
} = usePlayerControls(nowPlaying, activeSource, iframeRef, spotifyEmbedRef);

// ── Embed URL (YouTube only — Spotify is managed by the controller) ────────
const youtubeEmbedUrl = computed(() => {
  const s = nowPlaying.value;
  if (!s || activeSource.value !== "youtube") return null;
  if (s.youtube_video_id && s.youtube_playlist_id)
    return `https://www.youtube.com/embed/${s.youtube_video_id}?list=${s.youtube_playlist_id}&autoplay=1&rel=0&enablejsapi=1`;
  if (s.youtube_video_id)
    return `https://www.youtube.com/embed/${s.youtube_video_id}?autoplay=1&rel=0&enablejsapi=1`;
  if (s.youtube_playlist_id)
    return `https://www.youtube.com/embed/videoseries?list=${s.youtube_playlist_id}&autoplay=1&enablejsapi=1`;
  return null;
});

const hasSource = computed(
  () =>
    (activeSource.value === "youtube" && !!youtubeEmbedUrl.value) ||
    (activeSource.value === "spotify" && hasSpotify.value),
);

onUnmounted(() => {
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", onResizeEnd);
});
</script>

<template>
  <div
    v-if="nowPlaying"
    class="player-widget"
    :class="{ minimized }"
    :style="{ width: displayWidth + 'px' }"
  >
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
    <div class="player-header">
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

    <!-- Player body — v-show keeps the iframe alive when minimized -->
    <div v-show="!minimized" class="player-body">
      <div
        v-if="hasSource"
        class="embed-wrap"
        :style="{ width: width + 'px', height: height + 'px' }"
      >
        <!-- YouTube iframe -->
        <iframe
          v-if="activeSource === 'youtube' && youtubeEmbedUrl"
          ref="iframeRef"
          :key="`${nowPlaying.id}-youtube`"
          :src="youtubeEmbedUrl"
          :width="width"
          :height="height"
          frameborder="0"
          allow="
            autoplay;
            clipboard-write;
            encrypted-media;
            fullscreen;
            picture-in-picture;
          "
          allowfullscreen
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
      <div v-else class="no-source">
        <p class="no-source-text">No embeddable source available.</p>
        <StreamingLinks :links="nowPlaying.streaming_links ?? []" />
      </div>

      <div
        v-if="nowPlaying.source_type === 'playlist' && hasSource"
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
</template>

<style scoped>
.player-widget {
  position: fixed;
  bottom: 0.5rem;
  right: 1.5rem;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  z-index: 200;
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
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 1;
}

.player-widget:hover .resize-handle {
  opacity: 1;
}
.resize-handle:hover {
  color: var(--text-secondary);
}

.player-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  border-radius: 6px 6px 0 0;
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
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-composer {
  font-size: 0.8rem;
  color: var(--text-muted);
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
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.action-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.source-bar {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
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
  color: var(--text-muted);
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
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--border) 40%, transparent);
}

.source-btn.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}

/* Per-platform accent on active tab */
.source-btn:first-child.active {
  border-bottom-color: #ff0000;
  color: #ff4444;
}

.source-btn:last-child.active {
  border-bottom-color: #1db954;
  color: #1db954;
}

.player-body {
  display: flex;
  flex-direction: column;
}

.embed-wrap {
  overflow: hidden;
  background: #000;
  flex-shrink: 0;
}

.embed-wrap iframe {
  display: block;
  border: none;
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
  color: var(--text-muted);
}

.spotify-hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.75rem;
  background: color-mix(in srgb, #1db954 8%, transparent);
  border-top: 1px solid color-mix(in srgb, #1db954 20%, transparent);
  font-size: 0.7rem;
  color: var(--text-muted);
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
  color: var(--border);
}

.hint-reload {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.hint-reload:hover {
  color: var(--text-primary);
}

.hint-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  margin-left: auto;
  transition: color 0.15s;
}

.hint-dismiss:hover {
  color: var(--text-primary);
}

.player-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
}

.meta-dot {
  color: var(--border);
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
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
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
  background: var(--border);
  border-radius: 99px;
  outline: none;
  cursor: pointer;
  accent-color: var(--text-primary);
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-primary);
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
  background: var(--text-primary);
  cursor: pointer;
}

.track-nav-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}

.track-nav-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}

.playlist-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.75rem;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
}

.playlist-nav-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.playlist-nav-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.minimized .player-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  border-radius: 6px;
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
  color: #fff;
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
</style>
