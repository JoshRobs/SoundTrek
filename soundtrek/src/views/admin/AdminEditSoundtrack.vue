<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { storeToRefs } from "pinia";
import { supabase } from "@/lib/supabase";
import { toSlug } from "@/utils/slug";
import { useSoundtrackStore } from "@/stores/soundtracks";
import type { Soundtrack, StreamingPlatform } from "@/types/soundtrack";

const { allSoundtracks } = storeToRefs(useSoundtrackStore());

// ── Search ────────────────────────────────────────────────────────────────────

const query        = ref("");
const selected     = ref<Soundtrack | null>(null);
const searchOpen   = ref(false);

const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return allSoundtracks.value
    .filter(s => s.game_title.toLowerCase().includes(q))
    .slice(0, 10);
});

function pick(s: Soundtrack) {
  selected.value  = s;
  query.value     = s.game_title;
  searchOpen.value = false;
  populateForm(s);
}

function closeSearch() { setTimeout(() => { searchOpen.value = false }, 150); }

function clearSelection() {
  selected.value = null;
  query.value    = "";
  resetForm();
}

// ── Form state ────────────────────────────────────────────────────────────────

const form = ref(blankForm());

function blankForm() {
  return {
    game_title:          "",
    studio:              "",
    console:             "",
    release_year:        new Date().getFullYear(),
    source_type:         "video" as "video" | "playlist",
    slug:                "",
    slugManual:          false,
    description:         "",
    cover_image_url:     "",
    cover_image_url_hd:  "",
    youtube_playlist_id: "",
    youtube_video_id:    "",
    spotify_id:          "",
    spotify_type:        "" as "track" | "album" | "playlist" | "",
    amazon_url:          "",
    amazon_image_url:    "",
    composers:           "",
    genre_tags:          "",
    theme_tags:          "",
    keyword_tags:        "",
  };
}

function resetForm() {
  form.value = blankForm();
  streamingLinks.value = [];
}

function populateForm(s: Soundtrack) {
  form.value = {
    game_title:          s.game_title,
    studio:              s.studio,
    console:             s.console,
    release_year:        s.release_year,
    source_type:         s.source_type,
    slug:                s.slug ?? "",
    slugManual:          true,
    description:         s.description ?? "",
    cover_image_url:     s.cover_image_url ?? "",
    cover_image_url_hd:  s.cover_image_url_hd ?? "",
    youtube_playlist_id: s.youtube_playlist_id ?? "",
    youtube_video_id:    s.youtube_video_id ?? "",
    spotify_id:          s.spotify_id ?? "",
    spotify_type:        (s.spotify_type ?? "") as "track" | "album" | "playlist" | "",
    amazon_url:          s.amazon_url ?? "",
    amazon_image_url:    s.amazon_image_url ?? "",
    composers:           (s.composers ?? []).join(", "),
    genre_tags:          (s.genre_tags ?? []).join(", "),
    theme_tags:          (s.theme_tags ?? []).join(", "),
    keyword_tags:        (s.keyword_tags ?? []).join(", "),
  };
  streamingLinks.value = (s.streaming_links ?? []).map(l => ({
    platform: l.platform,
    url:      l.url,
    label:    l.label ?? "",
  }));
}

// Auto-generate slug only if not manually set
watch(() => form.value.game_title, (title) => {
  if (!form.value.slugManual) form.value.slug = toSlug(title);
});

// ── Streaming Links ───────────────────────────────────────────────────────────

const streamingLinks = ref<{ platform: StreamingPlatform; url: string; label: string }[]>([]);
function addLink()         { streamingLinks.value.push({ platform: "other", url: "", label: "" }); }
function removeLink(i: number) { streamingLinks.value.splice(i, 1); }

// ── Submit ────────────────────────────────────────────────────────────────────

const saving  = ref(false);
const success = ref<string | null>(null);
const error   = ref<string | null>(null);

function splitTags(raw: string): string[] {
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

async function submit() {
  if (!selected.value) return;
  error.value   = null;
  success.value = null;

  if (!form.value.game_title.trim()) { error.value = "Game title is required."; return; }
  if (!form.value.studio.trim())     { error.value = "Studio is required.";     return; }
  if (!form.value.console.trim())    { error.value = "Console is required.";    return; }

  saving.value = true;

  const row = {
    game_title:          form.value.game_title.trim(),
    studio:              form.value.studio.trim(),
    console:             form.value.console.trim(),
    release_year:        Number(form.value.release_year),
    source_type:         form.value.source_type,
    slug:                form.value.slug.trim() || null,
    description:         form.value.description.trim()         || null,
    cover_image_url:     form.value.cover_image_url.trim()     || null,
    cover_image_url_hd:  form.value.cover_image_url_hd.trim()  || null,
    youtube_playlist_id: form.value.youtube_playlist_id.trim() || null,
    youtube_video_id:    form.value.youtube_video_id.trim()    || null,
    spotify_id:          form.value.spotify_id.trim()          || null,
    spotify_type:        form.value.spotify_type               || null,
    amazon_url:          form.value.amazon_url.trim()          || null,
    amazon_image_url:    form.value.amazon_image_url.trim()    || null,
    composers:           splitTags(form.value.composers),
    genre_tags:          splitTags(form.value.genre_tags),
    theme_tags:          splitTags(form.value.theme_tags),
    keyword_tags:        splitTags(form.value.keyword_tags),
    streaming_links:     streamingLinks.value
      .filter(l => l.url.trim())
      .map(l => ({ platform: l.platform, url: l.url.trim(), ...(l.label.trim() ? { label: l.label.trim() } : {}) })),
  };

  const { error: err } = await supabase
    .from("soundtracks")
    .update(row)
    .eq("id", selected.value.id);

  saving.value = false;

  if (err) {
    error.value = err.message;
  } else {
    success.value = "Saved successfully.";
    // Update local store so changes reflect immediately without a reload
    Object.assign(selected.value, { ...row, streaming_links: row.streaming_links });
  }
}
</script>

<template>
  <div class="edit-page">

    <!-- ── Search ──────────────────────────────────────────────────────────── -->
    <div class="search-bar">
      <div class="search-wrap">
        <input
          v-model="query"
          type="text"
          placeholder="Search soundtracks by title…"
          class="search-input"
          @focus="searchOpen = true"
          @blur="closeSearch"
          @input="searchOpen = true"
        />
        <button v-if="selected" class="clear-btn" type="button" @click="clearSelection">✕</button>
        <ul v-if="searchOpen && results.length" class="search-dropdown">
          <li
            v-for="s in results"
            :key="s.id"
            class="search-item"
            @mousedown.prevent
            @click="pick(s)"
          >
            <img v-if="s.cover_image_url" :src="s.cover_image_url" class="search-thumb" />
            <span class="search-fallback" v-else>🎮</span>
            <div>
              <p class="search-title">{{ s.game_title }}</p>
              <p class="search-meta">{{ s.studio }} · {{ s.release_year }}</p>
            </div>
          </li>
        </ul>
      </div>
      <p v-if="selected" class="selected-id">ID: {{ selected.id }}</p>
    </div>

    <!-- ── Form ────────────────────────────────────────────────────────────── -->
    <form v-if="selected" class="add-form" @submit.prevent="submit">

      <section class="form-section">
        <h2 class="section-title">Basic Info <span class="required-note">* required</span></h2>
        <div class="field-grid">
          <label class="field">
            <span>Game Title *</span>
            <input v-model="form.game_title" type="text" />
          </label>
          <label class="field">
            <span>Studio *</span>
            <input v-model="form.studio" type="text" />
          </label>
          <label class="field">
            <span>Console *</span>
            <input v-model="form.console" type="text" />
          </label>
          <label class="field">
            <span>Release Year *</span>
            <input v-model="form.release_year" type="number" min="1970" max="2100" />
          </label>
          <label class="field">
            <span>Source Type</span>
            <select v-model="form.source_type">
              <option value="video">video</option>
              <option value="playlist">playlist</option>
            </select>
          </label>
          <label class="field">
            <span>Composers <em>(comma-separated)</em></span>
            <input v-model="form.composers" type="text" />
          </label>
        </div>
        <label class="field field--full">
          <span>Description</span>
          <textarea v-model="form.description" rows="3" />
        </label>
      </section>

      <section class="form-section">
        <h2 class="section-title">URL Slug</h2>
        <label class="field field--full">
          <span>Slug</span>
          <input v-model="form.slug" type="text" @input="form.slugManual = true" />
        </label>
        <p class="field-hint">Preview: /soundtrack/{{ form.slug || "…" }}</p>
      </section>

      <section class="form-section">
        <h2 class="section-title">Cover Images</h2>
        <div class="field-grid">
          <label class="field">
            <span>Cover Image URL</span>
            <input v-model="form.cover_image_url" type="url" />
          </label>
          <label class="field">
            <span>Cover Image URL (HD)</span>
            <input v-model="form.cover_image_url_hd" type="url" />
          </label>
        </div>
        <div v-if="form.cover_image_url" class="cover-preview">
          <img :src="form.cover_image_url" alt="Cover preview" />
        </div>
      </section>

      <section class="form-section">
        <h2 class="section-title">YouTube</h2>
        <div class="field-grid">
          <label class="field">
            <span>Playlist ID</span>
            <input v-model="form.youtube_playlist_id" type="text" />
          </label>
          <label class="field">
            <span>Video ID</span>
            <input v-model="form.youtube_video_id" type="text" />
          </label>
        </div>
      </section>

      <section class="form-section">
        <h2 class="section-title">Spotify</h2>
        <div class="field-grid">
          <label class="field">
            <span>Spotify ID</span>
            <input v-model="form.spotify_id" type="text" />
          </label>
          <label class="field">
            <span>Spotify Type</span>
            <select v-model="form.spotify_type">
              <option value="">— none —</option>
              <option value="album">album</option>
              <option value="playlist">playlist</option>
              <option value="track">track</option>
            </select>
          </label>
        </div>
      </section>

      <section class="form-section">
        <h2 class="section-title">Amazon</h2>
        <div class="field-grid">
          <label class="field">
            <span>Amazon URL</span>
            <input v-model="form.amazon_url" type="url" />
          </label>
          <label class="field">
            <span>Amazon Image URL</span>
            <input v-model="form.amazon_image_url" type="url" />
          </label>
        </div>
      </section>

      <section class="form-section">
        <h2 class="section-title">Tags <em>(comma-separated)</em></h2>
        <div class="field-grid">
          <label class="field">
            <span>Genre Tags</span>
            <input v-model="form.genre_tags" type="text" />
          </label>
          <label class="field">
            <span>Theme Tags</span>
            <input v-model="form.theme_tags" type="text" />
          </label>
          <label class="field">
            <span>Keyword Tags</span>
            <input v-model="form.keyword_tags" type="text" />
          </label>
        </div>
      </section>

      <section class="form-section">
        <h2 class="section-title">Additional Streaming Links</h2>
        <div v-for="(link, i) in streamingLinks" :key="i" class="link-row">
          <select v-model="link.platform">
            <option value="spotify">Spotify</option>
            <option value="youtube">YouTube</option>
            <option value="apple_music">Apple Music</option>
            <option value="bandcamp">Bandcamp</option>
            <option value="soundcloud">SoundCloud</option>
            <option value="amazon_music">Amazon Music</option>
            <option value="other">Other</option>
          </select>
          <input v-model="link.url" type="url" placeholder="https://…" />
          <input v-model="link.label" type="text" placeholder="Label (optional)" />
          <button type="button" class="remove-btn" @click="removeLink(i)">✕</button>
        </div>
        <button type="button" class="add-link-btn" @click="addLink">+ Add Link</button>
      </section>

      <div class="form-footer">
        <p v-if="error"   class="msg msg--error">{{ error }}</p>
        <p v-if="success" class="msg msg--success">{{ success }}</p>
        <button type="submit" class="submit-btn" :disabled="saving">
          {{ saving ? "Saving…" : "Save Changes" }}
        </button>
      </div>

    </form>

    <p v-else class="empty-hint">Search for a soundtrack above to edit it.</p>

  </div>
</template>

<style scoped>
.edit-page {
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.search-bar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.search-wrap {
  position: relative;
  max-width: 480px;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.55rem 2rem 0.55rem 0.75rem;
  font-size: 0.9rem;
  color: var(--text-primary);
  font-family: inherit;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.clear-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.2rem;
}

.clear-btn:hover { color: var(--text-primary); }

.search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  list-style: none;
  margin: 0;
  padding: 0.25rem;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.search-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
}

.search-item:hover { background: var(--surface); }

.search-thumb {
  width: 32px;
  height: 42px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.search-fallback {
  width: 32px;
  text-align: center;
}

.search-title {
  font-size: 0.85rem;
  color: var(--text-primary);
  margin: 0;
}

.search-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

.selected-id {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin: 0;
  font-family: monospace;
}

.empty-hint {
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* Shared form styles */
.add-form { display: flex; flex-direction: column; gap: 0; }

.form-section {
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 0;
}

.required-note {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.75rem;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.field--full { width: 100%; }
.field em { font-style: normal; color: var(--text-muted); font-size: 0.75rem; }

.field input, .field select, .field textarea {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.45rem 0.65rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-family: inherit;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.field input:focus, .field select:focus, .field textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.field textarea { resize: vertical; }
.field-hint { font-size: 0.75rem; color: var(--text-muted); margin: 0; }

.cover-preview img {
  height: 100px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid var(--border);
}

.link-row {
  display: grid;
  grid-template-columns: 140px 1fr 160px 28px;
  gap: 0.5rem;
  align-items: center;
}

.link-row input, .link-row select {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
  color: var(--text-primary);
  font-family: inherit;
}

.remove-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.85rem; padding: 0.25rem; }
.remove-btn:hover { color: #f87171; }

.add-link-btn {
  align-self: flex-start;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
  font-size: 0.82rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.add-link-btn:hover { border-color: var(--accent); color: var(--accent); }

.form-footer {
  padding-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.msg { font-size: 0.875rem; margin: 0; padding: 0.6rem 0.9rem; border-radius: 6px; }
.msg--error   { background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.3); }
.msg--success { background: rgba(74,222,128,0.1);  color: #4ade80; border: 1px solid rgba(74,222,128,0.3); }

.submit-btn {
  align-self: flex-start;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.65rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
