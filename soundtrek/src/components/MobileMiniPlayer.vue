<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { usePlayerControls } from "@/composables/usePlayerControls";
import SpotifyEmbed from "./SpotifyEmbed.vue";

const router = useRouter();
const store = useSoundtrackStore();
const { nowPlaying } = storeToRefs(store);

const sheetOpen = ref(false);
const activeSource = ref<"youtube" | "spotify">("youtube");

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

// ── Player controls ────────────────────────────────────────────────────────
const ytContainerRef = ref<HTMLElement | null>(null);
const spotifyEmbedRef = ref<InstanceType<typeof SpotifyEmbed> | null>(null);
const {
  isPlaying,
  currentTrackIndex,
  playerVideoIds,
  togglePlay,
  nextTrack,
  prevTrack,
  playTrackAt,
  ytPlaylistMode,
  setYtPlaylistMode,
} = usePlayerControls(
  nowPlaying,
  activeSource,
  ytContainerRef,
  spotifyEmbedRef,
);

const isPlaylist = computed(
  () => nowPlaying.value?.source_type === "playlist" && ytPlaylistMode.value,
);

const canToggleMode = computed(
  () =>
    activeSource.value === "youtube" &&
    !!nowPlaying.value?.youtube_playlist_id &&
    !!nowPlaying.value?.youtube_video_id,
);

// ── Playlist items ─────────────────────────────────────────────────────────
interface PlaylistItem { videoId: string; title: string; unavailable: boolean }
const playlistItems = ref<PlaylistItem[]>([]);

watch(
  nowPlaying,
  async (track) => {
    playlistItems.value = [];
    if (!track?.youtube_playlist_id) return;
    const proxyUrl = import.meta.env.VITE_YOUTUBE_PROXY_URL;
    if (!proxyUrl) return;
    try {
      const res = await fetch(`${proxyUrl}/playlist/${track.youtube_playlist_id}`);
      if (!res.ok) return;
      playlistItems.value = await res.json();
    } catch {}
  },
  { immediate: true },
);

function playVideoById(videoId: string) {
  const idx = playerVideoIds.value.indexOf(videoId);
  if (idx !== -1) playTrackAt(idx);
}

// ── Persistence ────────────────────────────────────────────────────────────
let skipNextReset = false;

watch(nowPlaying, (s) => {
  if (s) localStorage.setItem("player-track", JSON.stringify(s));
  else localStorage.removeItem("player-track");
});

watch(activeSource, (src) => localStorage.setItem("player-source", src));

watch(nowPlaying, (s, prev) => {
  if (!s) {
    sheetOpen.value = false;
    return;
  }
  if (skipNextReset) {
    skipNextReset = false;
    return;
  }
  const hasYt = !!(s.youtube_video_id || s.youtube_playlist_id);
  activeSource.value = hasYt ? "youtube" : "spotify";
  if (!prev) sheetOpen.value = true;
});

// Sync playlist video id across refreshes
const pendingVideoId = ref<string | null>(null);

watch([currentTrackIndex, playerVideoIds], () => {
  const vid = playerVideoIds.value[currentTrackIndex.value];
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

onMounted(() => {
  const raw = localStorage.getItem("player-track");
  if (!raw) return;
  try {
    const track = JSON.parse(raw);
    const src = (localStorage.getItem("player-source") ?? "youtube") as
      | "youtube"
      | "spotify";
    pendingVideoId.value = localStorage.getItem("player-video-id");
    skipNextReset = true;
    store.setNowPlaying(track);
    activeSource.value = src;
  } catch {
    localStorage.removeItem("player-track");
  }
});

// ── Touch-to-dismiss sheet ─────────────────────────────────────────────────
const sheetEl = ref<HTMLElement | null>(null);
let touchStartY = 0;
let touchCurrentY = 0;

function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0].clientY;
  touchCurrentY = touchStartY;
}

function onTouchMove(e: TouchEvent) {
  touchCurrentY = e.touches[0].clientY;
  const delta = touchCurrentY - touchStartY;
  if (delta > 0 && sheetEl.value) {
    sheetEl.value.style.transform = `translateY(${delta}px)`;
  }
}

function onTouchEnd() {
  const delta = touchCurrentY - touchStartY;
  if (sheetEl.value) sheetEl.value.style.transform = "";
  if (delta > 80) sheetOpen.value = false;
}

// ── Spacebar global shortcut ───────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key !== " " || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (!nowPlaying.value) return;
  e.preventDefault();
  togglePlay();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

function goToPage() {
  if (nowPlaying.value) router.push(`/soundtrack/${nowPlaying.value.id}`);
  sheetOpen.value = false;
}
</script>

<template>
  <template v-if="nowPlaying">
    <!-- ── Mini bar ─────────────────────────────────────────────────────── -->
    <div class="mini-bar" @click="sheetOpen = true">
      <img
        v-if="nowPlaying.cover_image_url"
        class="mini-cover"
        :src="nowPlaying.cover_image_url"
        :alt="nowPlaying.game_title"
      />
      <div v-else class="mini-cover mini-cover--fallback">🎮</div>

      <div class="mini-info">
        <span class="mini-title">{{ nowPlaying.game_title }}</span>
        <span class="mini-artist">{{
          (nowPlaying.composers ?? []).join(", ") || nowPlaying.studio
        }}</span>
      </div>

      <button
        class="mini-btn"
        :aria-label="isPlaying ? 'Pause' : 'Play'"
        @click.stop="togglePlay"
      >
        <svg
          v-if="isPlaying"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
        <svg
          v-else
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="currentColor"
          style="padding-left: 2px"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <button
        class="mini-btn"
        aria-label="Close player"
        @click.stop="store.setNowPlaying(null)"
      >
        <svg
          width="18"
          height="18"
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

    <!-- ── Full-screen sheet ──────────────────────────────────────────── -->
    <!-- Always in DOM so ytContainerRef exists when usePlayerControls inits -->
    <Teleport to="body">
      <div
        class="sheet-backdrop"
        :class="{ 'sheet-backdrop--open': sheetOpen }"
        @click.self="sheetOpen = false"
      >
        <div
          ref="sheetEl"
          class="sheet"
          @touchstart.passive="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <!-- Handle + header -->
          <div class="sheet-handle-area" @click="sheetOpen = false">
            <div class="sheet-handle" />
          </div>

          <div class="sheet-header">
            <button class="sheet-page-btn" @click="goToPage">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              View soundtrack
            </button>
            <button
              class="sheet-close-btn"
              aria-label="Close"
              @click="sheetOpen = false"
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

          <!-- Source tabs -->
          <div v-if="hasBoth" class="source-bar">
            <button
              class="source-btn"
              :class="{ active: activeSource === 'youtube' }"
              @click="activeSource = 'youtube'"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
              </svg>
              YouTube
            </button>
            <button
              class="source-btn"
              :class="{ active: activeSource === 'spotify' }"
              @click="activeSource = 'spotify'"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Spotify
            </button>
          </div>

          <!-- Embed -->
          <div class="sheet-embed">
            <div
              v-if="activeSource === 'youtube' && hasYoutube"
              ref="ytContainerRef"
              class="yt-container"
            />
            <a
              v-if="activeSource === 'spotify' && hasSpotify"
              :href="`https://open.spotify.com/${nowPlaying.spotify_type}/${nowPlaying.spotify_id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="spotify-open"
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <span class="spotify-open-label">Open in Spotify</span>
              <span class="spotify-open-sub">Tap to open the Spotify app</span>
            </a>
          </div>

          <!-- Playlist mode toggle + track list -->
          <div v-if="canToggleMode" class="playlist-toggle-row">
            <button class="playlist-toggle-btn" @click="setYtPlaylistMode(!ytPlaylistMode)">
              <svg v-if="ytPlaylistMode" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              {{ ytPlaylistMode ? 'Single video' : 'Full playlist' }}
            </button>
          </div>

          <div v-if="isPlaylist && playlistItems.length" class="playlist-list">
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

          <!-- Track info -->
          <div class="sheet-info">
            <img
              v-if="nowPlaying.cover_image_url"
              class="sheet-cover"
              :src="nowPlaying.cover_image_url"
              :alt="nowPlaying.game_title"
            />
            <div class="sheet-text">
              <p class="sheet-title">{{ nowPlaying.game_title }}</p>
              <p class="sheet-artist">
                {{
                  (nowPlaying.composers ?? []).join(", ") || nowPlaying.studio
                }}
              </p>
              <p class="sheet-meta">
                {{ nowPlaying.console }} · {{ nowPlaying.release_year }}
              </p>
            </div>
          </div>

          <!-- Playback controls -->
          <div class="sheet-controls">
            <button
              v-if="isPlaylist"
              class="ctrl-btn"
              aria-label="Previous track"
              @click="prevTrack"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>

            <button
              class="ctrl-play"
              :aria-label="isPlaying ? 'Pause' : 'Play'"
              @click="togglePlay"
            >
              <svg
                v-if="isPlaying"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              <svg
                v-else
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
                style="padding-left: 3px"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>

            <button
              v-if="isPlaylist"
              class="ctrl-btn"
              aria-label="Next track"
              @click="nextTrack"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </template>
</template>

<style scoped>
/* ── Mini bar ─────────────────────────────────────────────────────────────── */
.mini-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 72px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  padding-bottom: env(safe-area-inset-bottom);
  background: #111;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 150;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mini-cover {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.mini-cover--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  font-size: 1.4rem;
}

.mini-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.mini-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-artist {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}

.mini-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

/* ── Sheet backdrop ───────────────────────────────────────────────────────── */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 300;
  display: flex;
  align-items: flex-end;
}

/* ── Sheet ────────────────────────────────────────────────────────────────── */
.sheet {
  width: 100%;
  max-height: 95dvh;
  background: #0f0f0f;
  border-radius: 16px 16px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom);
}

.sheet-handle-area {
  display: flex;
  justify-content: center;
  padding: 0.75rem 0 0.25rem;
  cursor: pointer;
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.2);
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 1rem 0.75rem;
}

.sheet-page-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.78rem;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.sheet-page-btn:active {
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.3);
}

.sheet-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}

/* ── Source tabs ──────────────────────────────────────────────────────────── */
.source-bar {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: #0d0d0d;
  flex-shrink: 0;
}

.source-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.source-btn.active:first-child {
  border-bottom-color: #ff3333;
  color: #ff3333;
}

.source-btn.active:last-child {
  border-bottom-color: #1db954;
  color: #1db954;
}

/* ── Embed ────────────────────────────────────────────────────────────────── */
.sheet-embed {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  flex-shrink: 0;
}

.yt-container {
  width: 100%;
  height: 100%;
}

.yt-container :deep(iframe) {
  display: block;
  border: none;
}

/* ── Open in Spotify ──────────────────────────────────────────────────────── */
.spotify-open {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  height: 100%;
  text-decoration: none;
  background: #121212;
  color: #1db954;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.spotify-open:active {
  background: #1a1a1a;
}

.spotify-open-label {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.spotify-open-sub {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.35);
}

/* ── Playlist toggle ──────────────────────────────────────────────────────── */
.playlist-toggle-row {
  display: flex;
  padding: 0.5rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.playlist-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.65rem;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.72rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.15s, border-color 0.15s;
}

.playlist-toggle-btn:active {
  color: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.3);
}

/* ── Playlist track list ──────────────────────────────────────────────────── */
.playlist-list {
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: none;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.playlist-list::-webkit-scrollbar {
  display: none;
}

.playlist-track {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 1rem;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s;
}

.playlist-track:active {
  background: rgba(255, 255, 255, 0.05);
}

.playlist-track.active {
  background: rgba(255, 255, 255, 0.07);
}

.playlist-track.unavailable {
  opacity: 0.3;
  cursor: default;
}

.track-num {
  flex-shrink: 0;
  width: 1.4rem;
  text-align: right;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.2);
  font-variant-numeric: tabular-nums;
}

.playlist-track.active .track-num {
  color: rgba(255, 255, 255, 0.5);
}

.track-title {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.38);
  line-height: 1.3;
  text-align: left;
}

.playlist-track.active .track-title {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

/* ── Track info ───────────────────────────────────────────────────────────── */
.sheet-info {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.sheet-cover {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.sheet-text {
  min-width: 0;
  flex: 1;
}

.sheet-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sheet-artist {
  margin: 0.15rem 0 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sheet-meta {
  margin: 0.15rem 0 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.25);
}

/* ── Playback controls ────────────────────────────────────────────────────── */
.sheet-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 0.5rem 1rem 1rem;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.15s;
}

.ctrl-btn:active {
  color: rgba(255, 255, 255, 0.9);
}

.ctrl-play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  background: #fff;
  color: #000;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.12s,
    background 0.15s;
}

.ctrl-play:active {
  transform: scale(0.93);
  background: rgba(255, 255, 255, 0.85);
}

/* ── Sheet animation (CSS class-driven, no v-if) ──────────────────────────── */
.sheet-backdrop {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.sheet-backdrop--open {
  opacity: 1;
  pointer-events: auto;
}

.sheet {
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-backdrop--open .sheet {
  transform: translateY(0);
}
</style>
