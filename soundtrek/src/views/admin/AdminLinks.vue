<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { supabase } from "@/lib/supabase";
import { useSoundtrackStore } from "@/stores/soundtracks";

const { allSoundtracks } = storeToRefs(useSoundtrackStore());

// ── Alphabetical queue ────────────────────────────────────────────────────────

const sorted = computed(() =>
  [...allSoundtracks.value].sort((a, b) =>
    a.game_title.localeCompare(b.game_title),
  ),
);

const index = ref<number | null>(null);
const current = computed(() =>
  index.value === null ? null : (sorted.value[index.value] ?? null),
);

function next() {
  if (index.value !== null && index.value < sorted.value.length - 1)
    index.value++;
}
function prev() {
  if (index.value !== null && index.value > 0) index.value--;
}

// ── Starting-point picker ─────────────────────────────────────────────────────

const search = ref("");
const pickerOpen = ref(false);

const matches = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return [];
  const starts = sorted.value.filter((s) =>
    s.game_title.toLowerCase().startsWith(q),
  );
  const contains = sorted.value.filter(
    (s) =>
      !s.game_title.toLowerCase().startsWith(q) &&
      s.game_title.toLowerCase().includes(q),
  );
  return [...starts, ...contains].slice(0, 8);
});

function pick(id: string) {
  const i = sorted.value.findIndex((s) => s.id === id);
  if (i !== -1) index.value = i;
  search.value = "";
  pickerOpen.value = false;
}

function onSearchEnter() {
  if (matches.value.length) pick(matches.value[0].id);
}

// ── Editable fields ───────────────────────────────────────────────────────────

const playlistId = ref("");
const videoId = ref("");
const spotifyId = ref("");
const spotifyType = ref<"track" | "album" | "playlist">("album");

const saving = ref(false);
const saveError = ref<string | null>(null);
const success = ref<string | null>(null);

watch(
  current,
  (s) => {
    saveError.value = null;
    success.value = null;
    playlistId.value = s?.youtube_playlist_id ?? "";
    videoId.value = s?.youtube_video_id ?? "";
    spotifyId.value = s?.spotify_id ?? "";
    spotifyType.value = s?.spotify_type === "track" || s?.spotify_type === "playlist"
      ? s.spotify_type
      : "album";
    if (s) checkAll();
  },
  { immediate: true },
);

// ── Title resolution via oEmbed (no API keys needed) ──────────────────────────

interface Resolved {
  status: "empty" | "loading" | "ok" | "error";
  title?: string;
  error?: string;
}

const resolved = ref<{ playlist: Resolved; video: Resolved; spotify: Resolved }>({
  playlist: { status: "empty" },
  video: { status: "empty" },
  spotify: { status: "empty" },
});

let checkToken = 0;

async function resolveOembed(endpoint: string): Promise<Resolved> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      return {
        status: "error",
        error: `HTTP ${res.status} — broken, private, or deleted`,
      };
    }
    const data = (await res.json()) as { title?: string };
    return data.title
      ? { status: "ok", title: data.title }
      : { status: "error", error: "No title in response" };
  } catch {
    return { status: "error", error: "Request failed" };
  }
}

function ytOembed(url: string): string {
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
}

// YouTube has no oEmbed for playlists, so playlist titles go through the
// youtube-proxy worker, which holds the Data API key.
async function resolvePlaylist(id: string): Promise<Resolved> {
  const proxyUrl = import.meta.env.VITE_YOUTUBE_PROXY_URL;
  if (!proxyUrl) {
    return { status: "error", error: "VITE_YOUTUBE_PROXY_URL not configured" };
  }
  try {
    const res = await fetch(`${proxyUrl}/playlist-info/${id}`);
    if (res.status === 404) {
      return { status: "error", error: "Playlist not found — deleted or private" };
    }
    if (!res.ok) {
      return { status: "error", error: `Proxy error (HTTP ${res.status})` };
    }
    const data = (await res.json()) as {
      title: string;
      channel: string;
      itemCount?: number;
    };
    return {
      status: "ok",
      title: `${data.title} — ${data.channel}${
        data.itemCount != null ? ` (${data.itemCount} videos)` : ""
      }`,
    };
  } catch {
    return { status: "error", error: "Proxy unreachable — is the worker running?" };
  }
}

async function checkAll() {
  const token = ++checkToken;
  const pl = playlistId.value.trim();
  const vid = videoId.value.trim();
  const sp = spotifyId.value.trim();

  resolved.value = {
    playlist: { status: pl ? "loading" : "empty" },
    video: { status: vid ? "loading" : "empty" },
    spotify: { status: sp ? "loading" : "empty" },
  };

  const [plRes, vidRes, spRes] = await Promise.all([
    pl
      ? resolvePlaylist(pl)
      : Promise.resolve<Resolved>({ status: "empty" }),
    vid
      ? resolveOembed(ytOembed(`https://www.youtube.com/watch?v=${vid}`))
      : Promise.resolve<Resolved>({ status: "empty" }),
    sp
      ? resolveOembed(
          `https://open.spotify.com/oembed?url=${encodeURIComponent(
            `https://open.spotify.com/${spotifyType.value}/${sp}`,
          )}`,
        )
      : Promise.resolve<Resolved>({ status: "empty" }),
  ]);

  if (token !== checkToken) return; // stale — user already moved on
  resolved.value = { playlist: plRes, video: vidRes, spotify: spRes };
}

// ── External links ────────────────────────────────────────────────────────────

const playlistUrl = computed(() =>
  playlistId.value.trim()
    ? `https://www.youtube.com/playlist?list=${playlistId.value.trim()}`
    : null,
);
const videoUrl = computed(() =>
  videoId.value.trim()
    ? `https://www.youtube.com/watch?v=${videoId.value.trim()}`
    : null,
);
const spotifyUrl = computed(() =>
  spotifyId.value.trim()
    ? `https://open.spotify.com/${spotifyType.value}/${spotifyId.value.trim()}`
    : null,
);

// Platform searches for the current game — "sp" params are YouTube's
// result-type filters (EgIQAw = playlists only, EgIQAQ = videos only).
const searchQuery = computed(() =>
  current.value ? encodeURIComponent(`${current.value.game_title} OST soundtrack`) : "",
);
const playlistSearchUrl = computed(() =>
  current.value
    ? `https://www.youtube.com/results?search_query=${searchQuery.value}&sp=EgIQAw%3D%3D`
    : null,
);
const videoSearchUrl = computed(() =>
  current.value
    ? `https://www.youtube.com/results?search_query=${searchQuery.value}&sp=EgIQAQ%3D%3D`
    : null,
);
const spotifySearchUrl = computed(() =>
  current.value
    ? `https://open.spotify.com/search/${searchQuery.value}/albums`
    : null,
);

// ── Save ──────────────────────────────────────────────────────────────────────

async function save() {
  if (!current.value) return;
  saving.value = true;
  saveError.value = null;
  success.value = null;

  const fields = {
    youtube_playlist_id: playlistId.value.trim() || null,
    youtube_video_id: videoId.value.trim() || null,
    spotify_id: spotifyId.value.trim() || null,
    spotify_type: spotifyId.value.trim() ? spotifyType.value : null,
  };

  const { error } = await supabase
    .from("soundtracks")
    .update(fields)
    .eq("id", current.value.id);

  saving.value = false;

  if (error) {
    saveError.value = error.message;
  } else {
    const s = allSoundtracks.value.find((s) => s.id === current.value?.id);
    if (s) Object.assign(s, fields);
    success.value = "Saved.";
  }
}
</script>

<template>
  <div class="page">
    <!-- ── Starting point / navigation ────────────────────────────────────── -->
    <div class="queue-bar">
      <div class="picker">
        <input
          v-model="search"
          type="text"
          placeholder="Start from title…"
          @focus="pickerOpen = true"
          @blur="pickerOpen = false"
          @keydown.enter.prevent="onSearchEnter"
        />
        <div v-if="pickerOpen && matches.length" class="picker-results">
          <button
            v-for="m in matches"
            :key="m.id"
            class="picker-item"
            @mousedown.prevent="pick(m.id)"
          >
            {{ m.game_title }}
            <span class="picker-year">{{ m.release_year }}</span>
          </button>
        </div>
      </div>

      <div class="nav-controls">
        <span v-if="current" class="queue-count">
          {{ (index ?? 0) + 1 }} of {{ sorted.length }}
        </span>
        <button
          class="btn btn--ghost"
          :disabled="index === null || index === 0"
          @click="prev"
        >
          ← Prev
        </button>
        <button
          class="btn btn--ghost"
          :disabled="index === null || index >= sorted.length - 1"
          @click="next"
        >
          Next →
        </button>
      </div>
    </div>

    <template v-if="current">
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">
            {{ current.game_title }}
            <span class="meta-note">
              {{ current.composers?.length ? current.composers.join(", ") : "No composers" }}
              · {{ current.release_year }}
            </span>
          </h2>
          <button class="btn btn--primary" @click="checkAll">Re-check</button>
        </div>

        <!-- YouTube playlist -->
        <div class="link-row">
          <label class="field">
            <span>
              YouTube playlist ID
              <a
                v-if="playlistUrl"
                :href="playlistUrl"
                target="_blank"
                rel="noopener"
                class="open-link"
                >Open ↗</a
              >
              <a
                v-if="playlistSearchUrl"
                :href="playlistSearchUrl"
                target="_blank"
                rel="noopener"
                class="open-link"
                >Search ↗</a
              >
            </span>
            <input v-model="playlistId" type="text" placeholder="PL…" spellcheck="false" />
          </label>
          <p class="resolved" :class="`resolved--${resolved.playlist.status}`">
            <template v-if="resolved.playlist.status === 'ok'">{{ resolved.playlist.title }}</template>
            <template v-else-if="resolved.playlist.status === 'error'">{{ resolved.playlist.error }}</template>
            <template v-else-if="resolved.playlist.status === 'loading'">Checking…</template>
            <template v-else>Not set</template>
          </p>
        </div>

        <!-- YouTube video -->
        <div class="link-row">
          <label class="field">
            <span>
              YouTube video ID
              <a
                v-if="videoUrl"
                :href="videoUrl"
                target="_blank"
                rel="noopener"
                class="open-link"
                >Open ↗</a
              >
              <a
                v-if="videoSearchUrl"
                :href="videoSearchUrl"
                target="_blank"
                rel="noopener"
                class="open-link"
                >Search ↗</a
              >
            </span>
            <input v-model="videoId" type="text" placeholder="dQw4…" spellcheck="false" />
          </label>
          <p class="resolved" :class="`resolved--${resolved.video.status}`">
            <template v-if="resolved.video.status === 'ok'">{{ resolved.video.title }}</template>
            <template v-else-if="resolved.video.status === 'error'">{{ resolved.video.error }}</template>
            <template v-else-if="resolved.video.status === 'loading'">Checking…</template>
            <template v-else>Not set</template>
          </p>
        </div>

        <!-- Spotify -->
        <div class="link-row">
          <label class="field">
            <span>
              Spotify ID
              <a
                v-if="spotifyUrl"
                :href="spotifyUrl"
                target="_blank"
                rel="noopener"
                class="open-link"
                >Open ↗</a
              >
              <a
                v-if="spotifySearchUrl"
                :href="spotifySearchUrl"
                target="_blank"
                rel="noopener"
                class="open-link"
                >Search ↗</a
              >
            </span>
            <div class="spotify-inputs">
              <input v-model="spotifyId" type="text" placeholder="4aawyAB…" spellcheck="false" />
              <select v-model="spotifyType">
                <option value="album">album</option>
                <option value="playlist">playlist</option>
                <option value="track">track</option>
              </select>
            </div>
          </label>
          <p class="resolved" :class="`resolved--${resolved.spotify.status}`">
            <template v-if="resolved.spotify.status === 'ok'">{{ resolved.spotify.title }}</template>
            <template v-else-if="resolved.spotify.status === 'error'">{{ resolved.spotify.error }}</template>
            <template v-else-if="resolved.spotify.status === 'loading'">Checking…</template>
            <template v-else>Not set</template>
          </p>
        </div>

        <div class="save-row">
          <button class="btn btn--primary" :disabled="saving" @click="save">
            {{ saving ? "Saving…" : "Save" }}
          </button>
          <p v-if="saveError" class="msg msg--error">{{ saveError }}</p>
          <p v-if="success" class="msg msg--success">{{ success }}</p>
        </div>
      </section>
    </template>

    <p v-else class="hint">
      Type a game title above to pick a starting point, then use Next to walk
      the catalog alphabetically.
    </p>
  </div>
</template>

<style scoped>
.page {
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Queue bar */
.queue-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 1rem;
}

.queue-count {
  font-size: 0.85rem;
  color: #ffffffbb;
  white-space: nowrap;
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Picker */
.picker {
  position: relative;
  flex: 1;
  max-width: 320px;
}

.picker input {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.45rem 0.65rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}

.picker input:focus {
  outline: none;
  border-color: var(--accent);
}

.picker-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 20;
  overflow: hidden;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
}

.picker-item:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.picker-year {
  font-size: 0.72rem;
  color: #ffffff77;
  flex-shrink: 0;
}

/* Card */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.meta-note {
  font-size: 0.75rem;
  font-weight: 400;
  color: #ffffffbb;
  margin-left: 0.5rem;
}

/* Link rows */
.link-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.field input,
.field select {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.45rem 0.65rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--accent);
}

.spotify-inputs {
  display: flex;
  gap: 0.5rem;
}

.spotify-inputs select {
  width: auto;
  flex-shrink: 0;
}

.open-link {
  font-size: 0.75rem;
  color: var(--accent);
  text-decoration: none;
  margin-left: 0.4rem;
}

.open-link:hover {
  text-decoration: underline;
}

/* Resolved titles */
.resolved {
  margin: 0;
  font-size: 0.82rem;
  padding: 0.4rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.resolved--ok {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
}

.resolved--error {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

.resolved--loading,
.resolved--empty {
  color: #ffffff77;
}

/* Buttons */
.btn {
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--accent);
  color: #fff;
}

.btn--ghost {
  background: var(--surface-2);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn--ghost:hover:not(:disabled) {
  color: var(--text-primary);
}

/* Save row */
.save-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Messages */
.msg {
  font-size: 0.82rem;
  margin: 0;
  padding: 0.5rem 0.8rem;
  border-radius: 6px;
}

.msg--error {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.msg--success {
  background: rgba(74, 222, 128, 0.1);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.hint {
  font-size: 0.875rem;
  color: #ffffffbb;
}
</style>
