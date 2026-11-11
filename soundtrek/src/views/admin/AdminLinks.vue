<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { supabase } from "@/lib/supabase";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { syncTracklist } from "@/utils/syncTracklist";
import { useLinkCheck } from "@/composables/useLinkCheck";
import LinkStatus from "@/components/admin/LinkStatus.vue";
import type { Soundtrack } from "@/types/soundtrack";

const { allSoundtracks } = storeToRefs(useSoundtrackStore());

// ── Queue (alphabetical, or by when each soundtrack was added) ────────────────

type SortMode = "alpha" | "newest" | "oldest";
const sortMode = ref<SortMode>("alpha");

const sorted = computed(() => {
  const list = [...allSoundtracks.value];
  const byTitle = (a: Soundtrack, b: Soundtrack) =>
    a.game_title.localeCompare(b.game_title);
  if (sortMode.value === "alpha") return list.sort(byTitle);

  // Bulk inserts share a timestamp — fall back to title for a stable order.
  const dir = sortMode.value === "newest" ? -1 : 1;
  return list.sort(
    (a, b) =>
      dir * (Date.parse(a.created_at) - Date.parse(b.created_at)) ||
      byTitle(a, b),
  );
});

// Tracked by id rather than position so switching sort order keeps you on the
// same soundtrack (and doesn't wipe unsaved edits via the `current` watcher).
const currentId = ref<string | null>(null);
const index = computed(() => {
  if (currentId.value === null) return null;
  const i = sorted.value.findIndex((s) => s.id === currentId.value);
  return i === -1 ? null : i;
});
const current = computed(() =>
  index.value === null ? null : (sorted.value[index.value] ?? null),
);

function next() {
  if (index.value !== null && index.value < sorted.value.length - 1)
    currentId.value = sorted.value[index.value + 1].id;
}
function prev() {
  if (index.value !== null && index.value > 0)
    currentId.value = sorted.value[index.value - 1].id;
}
function jumpToStart() {
  if (sorted.value.length) currentId.value = sorted.value[0].id;
}

// Editable "N of M" counter — jump straight to a position in the current order.
const positionInput = ref("");
function syncPositionInput() {
  positionInput.value = index.value === null ? "" : String(index.value + 1);
}
watch(index, syncPositionInput, { immediate: true });

function goToPosition() {
  const n = parseInt(positionInput.value, 10);
  if (Number.isNaN(n) || !sorted.value.length) return syncPositionInput();
  const i = Math.min(Math.max(n, 1), sorted.value.length) - 1;
  currentId.value = sorted.value[i].id;
  syncPositionInput(); // out-of-range input clamps; reflect it even if index didn't change
}

const startLabel = computed(
  () =>
    ({ alpha: "Start at A", newest: "Start at newest", oldest: "Start at oldest" })[
      sortMode.value
    ],
);

function formatAdded(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  currentId.value = id;
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

// Resolves each ID to its title. Checked on every soundtrack change and via
// the Re-check button rather than while typing.
const {
  resolved,
  check: checkAll,
  playlistUrl,
  videoUrl,
  spotifyUrl,
  playlistSearchUrl,
  videoSearchUrl,
  spotifySearchUrl,
} = useLinkCheck({
  playlistId: () => playlistId.value,
  videoId: () => videoId.value,
  spotifyId: () => spotifyId.value,
  spotifyType: () => spotifyType.value,
  gameTitle: () => current.value?.game_title ?? "",
});

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
    spotifyType.value =
      s?.spotify_type === "track" || s?.spotify_type === "playlist"
        ? s.spotify_type
        : "album";
    if (s) checkAll();
  },
  { immediate: true },
);

// ── Save ──────────────────────────────────────────────────────────────────────

async function save() {
  // Pin the soundtrack being saved: the user can move to another one while
  // this is in flight, and everything after an await must still target this
  // one — never whatever `current` has become.
  const target = current.value;
  if (!target) return;
  saving.value = true;
  saveError.value = null;
  success.value = null;

  const prevPlaylistId = target.youtube_playlist_id;

  const fields = {
    youtube_playlist_id: playlistId.value.trim() || null,
    youtube_video_id: videoId.value.trim() || null,
    spotify_id: spotifyId.value.trim() || null,
    spotify_type: spotifyId.value.trim() ? spotifyType.value : null,
  };

  // Results are only shown if the user is still looking at this soundtrack.
  const stillHere = () => current.value?.id === target.id;
  const report = (msg: string) =>
    stillHere() ? msg : `${target.game_title}: ${msg}`;

  try {
    const { error } = await supabase
      .from("soundtracks")
      .update(fields)
      .eq("id", target.id);

    if (error) {
      saveError.value = report(error.message);
      return;
    }

    Object.assign(target, fields);

    // Regenerate this soundtrack's tracks rows to match the saved playlist.
    // Skipped entirely when there's no playlist now and wasn't one before.
    let trackNote = "";
    if (fields.youtube_playlist_id || prevPlaylistId) {
      try {
        trackNote = await syncTracklist(target.id, fields.youtube_playlist_id, {
          gameTitle: target.game_title,
          composers: target.composers,
          studio: target.studio,
        });
      } catch (e) {
        saveError.value = report(
          `Links saved, but tracklist sync failed: ${
            e instanceof Error ? e.message : "unknown error"
          }`,
        );
        return;
      }
    }

    success.value = report(trackNote ? `Saved — ${trackNote}.` : "Saved.");
  } finally {
    saving.value = false;
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
            <span class="picker-year">{{
              sortMode === "alpha" ? m.release_year : `added ${formatAdded(m.created_at)}`
            }}</span>
          </button>
        </div>
      </div>

      <div class="sort-controls">
        <select v-model="sortMode" class="sort-select" aria-label="Sort order">
          <option value="alpha">A–Z</option>
          <option value="newest">Newest added</option>
          <option value="oldest">Oldest added</option>
        </select>
        <button class="btn btn--ghost" :disabled="!sorted.length" @click="jumpToStart">
          {{ startLabel }}
        </button>
      </div>

      <div class="nav-controls">
        <span v-if="sorted.length" class="queue-count">
          <input
            v-model="positionInput"
            class="position-input"
            type="text"
            inputmode="numeric"
            placeholder="#"
            aria-label="Go to position"
            @keydown.enter.prevent="goToPosition"
            @blur="syncPositionInput"
          />
          of {{ sorted.length }}
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
              {{
                current.composers?.length
                  ? current.composers.join(", ")
                  : "No composers"
              }}
              · {{ current.release_year }}
              · added {{ formatAdded(current.created_at) }}
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
            <input
              v-model="playlistId"
              type="text"
              placeholder="PL…"
              spellcheck="false"
            />
          </label>
          <LinkStatus :result="resolved.playlist" />
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
            <input
              v-model="videoId"
              type="text"
              placeholder="dQw4…"
              spellcheck="false"
            />
          </label>
          <LinkStatus :result="resolved.video" />
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
              <input
                v-model="spotifyId"
                type="text"
                placeholder="4aawyAB…"
                spellcheck="false"
              />
              <select v-model="spotifyType">
                <option value="album">album</option>
                <option value="playlist">playlist</option>
                <option value="track">track</option>
              </select>
            </div>
          </label>
          <LinkStatus :result="resolved.spotify" />
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
      Type a game title above to pick a starting point, or choose a sort order
      and hit start (or type a position number and press Enter), then use Next
      to walk the catalog. “Newest added” puts the most recently added
      soundtracks first.
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
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 1rem;
}

.sort-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-select {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.55rem;
  font-size: 0.82rem;
  color: var(--text-primary);
  font-family: inherit;
}

.sort-select:focus {
  outline: none;
  border-color: var(--accent);
}

.queue-count {
  font-size: 0.85rem;
  color: #ffffffbb;
  white-space: nowrap;
}

.position-input {
  width: 5ch;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.3rem 0.4rem;
  font-size: 0.85rem;
  color: var(--text-primary);
  font-family: inherit;
  text-align: center;
}

.position-input:focus {
  outline: none;
  border-color: var(--accent);
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
