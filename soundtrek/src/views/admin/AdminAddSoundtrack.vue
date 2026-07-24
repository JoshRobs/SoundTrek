<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { supabase } from "@/lib/supabase";
import { toSlug } from "@/utils/slug";
import type { StreamingPlatform } from "@/types/soundtrack";

// ── Form state ────────────────────────────────────────────────────────────────

const form = ref({
  // Required
  game_title:   "",
  studio:       "",
  console:      "",
  release_year: new Date().getFullYear(),
  source_type:  "video" as "video" | "playlist",

  // Slug (auto-generated, editable)
  slug: "",
  slugManual: false,

  // Description
  description: "",

  // Cover
  cover_image_url:    "",
  cover_image_url_hd: "",

  // YouTube
  youtube_playlist_id: "",
  youtube_video_id:    "",

  // Spotify
  spotify_id:   "",
  spotify_type: "" as "track" | "album" | "playlist" | "",

  // Amazon
  amazon_url:       "",
  amazon_image_url: "",

  // Tags (comma-separated strings internally)
  composers:    "",
  genre_tags:   "",
  theme_tags:   "",
  keyword_tags: "",
});

// Auto-generate slug from title unless manually edited
watch(() => form.value.game_title, (title) => {
  if (!form.value.slugManual) {
    form.value.slug = toSlug(title);
  }
});

// IGDB-derived metadata that the form has no visible field for, carried through
// to the insert row so a manual import matches what ingest.ts would have stored.
const importedMeta = ref<{
  rating: number | null;
  rating_count: number | null;
  popularity: number | null;
} | null>(null);

// ── Import from IGDB (mirrors ingest.ts, for one manually named game) ──────────

interface IgdbCandidate {
  igdb_id: number;
  game_title: string;
  studio: string;
  console: string;
  release_year: number;
  cover_image_url: string | null;
  cover_image_url_hd: string | null;
  genre_tags: string[];
  rating: number | null;
  rating_count: number | null;
  popularity: number | null;
  // Filled in after we check our own DB for a title collision.
  existing?: { id: string; slug: string | null } | null;
}

const proxyUrl = import.meta.env.VITE_YOUTUBE_PROXY_URL as string | undefined;

const igdbQuery      = ref("");
const igdbSearching  = ref(false);
const igdbError      = ref<string | null>(null);
const igdbResults    = ref<IgdbCandidate[]>([]);
const igdbSearched   = ref(false);
const importingId    = ref<number | null>(null);
const importNote     = ref<string | null>(null);
const randomizing    = ref(false);

async function searchIgdb() {
  igdbError.value = null;
  importNote.value = null;
  const q = igdbQuery.value.trim();
  if (!q) return;
  if (!proxyUrl) {
    igdbError.value = "VITE_YOUTUBE_PROXY_URL is not configured.";
    return;
  }

  igdbSearching.value = true;
  igdbResults.value = [];
  igdbSearched.value = false;

  try {
    const res = await fetch(`${proxyUrl}/igdb-search?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `Search failed (HTTP ${res.status})`);
    }
    const data = (await res.json()) as { results: IgdbCandidate[] };
    const results = data.results ?? [];

    // Flag any candidate already in our DB (ingest skips these by exact title).
    if (results.length) {
      const titles = results.map((r) => r.game_title);
      const { data: existing } = await supabase
        .from("soundtracks")
        .select("id, slug, game_title")
        .in("game_title", titles);
      const byTitle = new Map(
        (existing ?? []).map((e) => [e.game_title as string, { id: e.id as string, slug: e.slug as string | null }]),
      );
      for (const r of results) r.existing = byTitle.get(r.game_title) ?? null;
    }

    igdbResults.value = results;
    igdbSearched.value = true;
  } catch (e) {
    igdbError.value = (e as Error).message;
  } finally {
    igdbSearching.value = false;
  }
}

async function surpriseMe() {
  igdbError.value = null;
  importNote.value = null;
  if (!proxyUrl) {
    igdbError.value = "VITE_YOUTUBE_PROXY_URL is not configured.";
    return;
  }

  randomizing.value = true;
  igdbResults.value = [];
  igdbSearched.value = false;

  try {
    // Each call returns a random batch; retry a few times in the rare case every
    // game in a batch is already in our catalog.
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${proxyUrl}/igdb-random-indie`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Random pick failed (HTTP ${res.status})`);
      }
      const data = (await res.json()) as { results: IgdbCandidate[] };
      const results = data.results ?? [];
      if (!results.length) continue;

      // Skip any already in our catalog.
      const titles = results.map((r) => r.game_title);
      const { data: existing } = await supabase
        .from("soundtracks")
        .select("game_title")
        .in("game_title", titles);
      const inDb = new Set((existing ?? []).map((e) => e.game_title as string));

      const pick = results.find((r) => !inDb.has(r.game_title));
      if (pick) {
        await importGame(pick);
        return;
      }
    }
    igdbError.value = "Couldn't find an indie game that's not already in your catalog — try again.";
  } catch (e) {
    igdbError.value = (e as Error).message;
  } finally {
    randomizing.value = false;
  }
}

async function importGame(c: IgdbCandidate) {
  if (c.existing) return; // already in DB — nothing to import
  importNote.value = null;
  igdbError.value = null;
  importingId.value = c.igdb_id;

  try {
    // Fill the IGDB-sourced fields.
    form.value.game_title        = c.game_title;
    form.value.studio            = c.studio;
    form.value.console           = c.console;
    form.value.release_year      = c.release_year || new Date().getFullYear();
    form.value.cover_image_url    = c.cover_image_url ?? "";
    form.value.cover_image_url_hd = c.cover_image_url_hd ?? "";
    form.value.genre_tags        = c.genre_tags.join(", ");
    // Slug auto-generates via the watcher on game_title (unless manually edited).
    form.value.slugManual = false;
    form.value.slug = toSlug(c.game_title);
    // Composers aren't in IGDB — ingest leaves them empty (enrich-composers fills later).
    form.value.composers = "";

    importedMeta.value = {
      rating: c.rating,
      rating_count: c.rating_count,
      popularity: c.popularity,
    };

    // YouTube OST lookup (mirrors searchYouTube in ingest.ts).
    let ytNote = "no YouTube OST found";
    if (proxyUrl) {
      try {
        const res = await fetch(
          `${proxyUrl}/youtube-search?q=${encodeURIComponent(c.game_title)}`,
        );
        if (res.ok) {
          const { result } = (await res.json()) as {
            result: {
              youtube_video_id: string | null;
              youtube_playlist_id: string | null;
              source_type: "video" | "playlist";
            } | null;
          };
          if (result) {
            form.value.source_type         = result.source_type;
            form.value.youtube_playlist_id = result.youtube_playlist_id ?? "";
            form.value.youtube_video_id    = result.youtube_video_id ?? "";
            ytNote = `YouTube ${result.source_type} found`;
          }
        } else {
          const body = await res.json().catch(() => ({})) as { error?: string };
          ytNote = `YouTube lookup failed: ${body.error ?? res.status}`;
        }
      } catch {
        ytNote = "YouTube lookup unreachable";
      }
    }

    importNote.value = `Imported "${c.game_title}" from IGDB — ${ytNote}. Review the fields below, then insert.`;
  } finally {
    importingId.value = null;
  }
}

// ── Link preview / open / search (mirrors AdminLinks.vue) ─────────────────────

interface Resolved {
  status: "empty" | "loading" | "ok" | "error";
  title?: string;
  error?: string;
}

const resolved = ref<{
  playlist: Resolved;
  video: Resolved;
  spotify: Resolved;
}>({
  playlist: { status: "empty" },
  video: { status: "empty" },
  spotify: { status: "empty" },
});

let checkToken = 0;

async function resolveOembed(endpoint: string): Promise<Resolved> {
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

async function resolveVideo(id: string): Promise<Resolved> {
  if (!proxyUrl) return { status: "error", error: "VITE_YOUTUBE_PROXY_URL not configured" };
  try {
    const res = await fetch(`${proxyUrl}/video-info/${id}`);
    if (res.status === 404) return { status: "error", error: "Video not found — deleted or private" };
    if (!res.ok) return { status: "error", error: `Proxy error (HTTP ${res.status})` };
    const data = (await res.json()) as { title: string; channel: string; duration?: string };
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
    const data = (await res.json()) as { title: string; channel: string; itemCount?: number };
    return {
      status: "ok",
      title: `${data.title}${data.itemCount != null ? ` (${data.itemCount} videos)` : ""}`,
    };
  } catch {
    return { status: "error", error: "Proxy unreachable — is the worker running?" };
  }
}

async function checkLinks() {
  const token = ++checkToken;
  const pl = form.value.youtube_playlist_id.trim();
  const vid = form.value.youtube_video_id.trim();
  const sp = form.value.spotify_id.trim();

  resolved.value = {
    playlist: { status: pl ? "loading" : "empty" },
    video: { status: vid ? "loading" : "empty" },
    spotify: { status: sp ? "loading" : "empty" },
  };

  const [plRes, vidRes, spRes] = await Promise.all([
    pl ? resolvePlaylist(pl) : Promise.resolve<Resolved>({ status: "empty" }),
    vid ? resolveVideo(vid) : Promise.resolve<Resolved>({ status: "empty" }),
    sp
      ? resolveOembed(
          `https://open.spotify.com/oembed?url=${encodeURIComponent(
            `https://open.spotify.com/${spotifyTypeForUrl.value}/${sp}`,
          )}`,
        )
      : Promise.resolve<Resolved>({ status: "empty" }),
  ]);

  if (token !== checkToken) return; // stale — fields changed again
  resolved.value = { playlist: plRes, video: vidRes, spotify: spRes };
}

// Auto-resolve as the ID fields change (debounced), including after an import.
let resolveTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [
    form.value.youtube_playlist_id,
    form.value.youtube_video_id,
    form.value.spotify_id,
    form.value.spotify_type,
  ],
  () => {
    clearTimeout(resolveTimer);
    resolveTimer = setTimeout(checkLinks, 400);
  },
);

// Spotify needs a type for its URL; the form field can be blank, default to album.
const spotifyTypeForUrl = computed(() => form.value.spotify_type || "album");

// External "Open ↗" links for whatever IDs are currently entered.
const playlistUrl = computed(() =>
  form.value.youtube_playlist_id.trim()
    ? `https://www.youtube.com/playlist?list=${form.value.youtube_playlist_id.trim()}`
    : null,
);
const videoUrl = computed(() =>
  form.value.youtube_video_id.trim()
    ? `https://www.youtube.com/watch?v=${form.value.youtube_video_id.trim()}`
    : null,
);
const spotifyUrl = computed(() =>
  form.value.spotify_id.trim()
    ? `https://open.spotify.com/${spotifyTypeForUrl.value}/${form.value.spotify_id.trim()}`
    : null,
);

// "Search ↗" links for the current game title — YouTube "sp" params filter
// results by type (EgIQAw = playlists only, EgIQAQ = videos only).
const searchQuery = computed(() =>
  form.value.game_title.trim()
    ? encodeURIComponent(`${form.value.game_title.trim()} full soundtrack`)
    : "",
);
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
  searchQuery.value
    ? `https://open.spotify.com/search/${searchQuery.value}/albums`
    : null,
);

// Streaming links
const streamingLinks = ref<{ platform: StreamingPlatform; url: string; label: string }[]>([]);
function addLink() {
  streamingLinks.value.push({ platform: "other", url: "", label: "" });
}
function removeLink(i: number) {
  streamingLinks.value.splice(i, 1);
}

// ── Submit ────────────────────────────────────────────────────────────────────

const saving  = ref(false);
const success = ref<string | null>(null);
const error   = ref<string | null>(null);

function splitTags(raw: string): string[] {
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

async function submit() {
  error.value   = null;
  success.value = null;

  if (!form.value.game_title.trim()) { error.value = "Game title is required."; return; }
  if (!form.value.studio.trim())     { error.value = "Studio is required.";     return; }
  if (!form.value.console.trim())    { error.value = "Console is required.";    return; }
  if (!form.value.release_year)      { error.value = "Release year is required."; return; }

  saving.value = true;

  const row = {
    game_title:          form.value.game_title.trim(),
    studio:              form.value.studio.trim(),
    console:             form.value.console.trim(),
    release_year:        Number(form.value.release_year),
    source_type:         form.value.source_type,
    slug:                form.value.slug.trim() || null,
    description:         form.value.description.trim()        || null,
    cover_image_url:     form.value.cover_image_url.trim()    || null,
    cover_image_url_hd:  form.value.cover_image_url_hd.trim() || null,
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
    // IGDB-derived ranking fields (only present when imported) — mirrors ingest.ts.
    ...(importedMeta.value
      ? {
          rating:       importedMeta.value.rating,
          rating_count: importedMeta.value.rating_count,
          popularity:   importedMeta.value.popularity,
        }
      : {}),
    streaming_links:     streamingLinks.value
      .filter(l => l.url.trim())
      .map(l => ({ platform: l.platform, url: l.url.trim(), ...(l.label.trim() ? { label: l.label.trim() } : {}) })),
  };

  const { data, error: err } = await supabase.from("soundtracks").insert(row).select("id, slug").single();

  saving.value = false;

  if (err) {
    error.value = err.message;
  } else {
    success.value = `Inserted! ID: ${data.id}`;
    // Open the new soundtrack in a new tab, leaving this form as-is.
    window.open(`/soundtrack/${data.slug ?? data.id}`, "_blank", "noopener");
  }
}
</script>

<template>
  <form class="add-form" @submit.prevent="submit">

    <!-- ── Import from IGDB ──────────────────────────────────────────────── -->
    <section class="form-section import-section">
      <h2 class="section-title">Import from IGDB</h2>
      <p class="field-hint">
        Search IGDB by game name, then pick a result to auto-fill the fields below —
        same metadata &amp; YouTube lookup the ingest script uses.
      </p>

      <div class="import-search">
        <input
          v-model="igdbQuery"
          type="text"
          placeholder="e.g. Hollow Knight"
          @keydown.enter.prevent="searchIgdb"
        />
        <button
          type="button"
          class="import-search-btn"
          :disabled="igdbSearching || randomizing || !igdbQuery.trim()"
          @click="searchIgdb"
        >
          {{ igdbSearching ? "Searching…" : "Search IGDB" }}
        </button>
      </div>

      <div class="import-or"><span>or</span></div>

      <button
        type="button"
        class="surprise-btn"
        :disabled="randomizing || igdbSearching"
        @click="surpriseMe"
      >
        {{ randomizing ? "Finding a game…" : "🎲 Surprise me with a new indie game" }}
      </button>

      <p v-if="igdbError" class="msg msg--error">{{ igdbError }}</p>
      <p v-if="importNote" class="msg msg--success">{{ importNote }}</p>

      <p v-if="igdbSearched && !igdbResults.length && !igdbSearching" class="field-hint">
        No games found on IGDB for that name.
      </p>

      <ul v-if="igdbResults.length" class="igdb-results">
        <li
          v-for="c in igdbResults"
          :key="c.igdb_id"
          class="igdb-result"
          :class="{ 'igdb-result--existing': c.existing }"
        >
          <div class="igdb-thumb">
            <img v-if="c.cover_image_url" :src="c.cover_image_url" :alt="c.game_title" />
            <span v-else class="igdb-thumb-fallback">🎮</span>
          </div>
          <div class="igdb-info">
            <span class="igdb-title">{{ c.game_title }}</span>
            <span class="igdb-meta">
              {{ c.studio }} · {{ c.console }}<template v-if="c.release_year"> · {{ c.release_year }}</template>
              <template v-if="c.rating_count"> · {{ c.rating_count }} ratings</template>
            </span>
            <span v-if="c.genre_tags.length" class="igdb-genres">{{ c.genre_tags.join(", ") }}</span>
          </div>
          <div class="igdb-action">
            <span v-if="c.existing" class="igdb-existing-badge">Already in DB</span>
            <button
              v-else
              type="button"
              class="igdb-import-btn"
              :disabled="importingId !== null"
              @click="importGame(c)"
            >
              {{ importingId === c.igdb_id ? "Importing…" : "Use this" }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- ── Required ──────────────────────────────────────────────────────── -->
    <section class="form-section">
      <h2 class="section-title">Basic Info <span class="required-note">* required</span></h2>
      <div class="field-grid">
        <label class="field">
          <span>Game Title *</span>
          <input v-model="form.game_title" type="text" placeholder="Hades" />
        </label>

        <label class="field">
          <span>Studio *</span>
          <input v-model="form.studio" type="text" placeholder="Supergiant Games" />
        </label>

        <label class="field">
          <span>Console *</span>
          <input v-model="form.console" type="text" placeholder="PC" />
        </label>

        <label class="field">
          <span>Release Year *</span>
          <input v-model="form.release_year" type="number" min="1970" max="2100" />
        </label>

        <label class="field">
          <span>Source Type *</span>
          <select v-model="form.source_type">
            <option value="video">video</option>
            <option value="playlist">playlist</option>
          </select>
        </label>

        <label class="field">
          <span>Composers <em>(comma-separated)</em></span>
          <input v-model="form.composers" type="text" placeholder="Darren Korb" />
        </label>
      </div>

      <label class="field field--full">
        <span>Description</span>
        <textarea v-model="form.description" rows="3" placeholder="Optional description..." />
      </label>
    </section>

    <!-- ── Slug ──────────────────────────────────────────────────────────── -->
    <section class="form-section">
      <h2 class="section-title">URL Slug</h2>
      <label class="field field--full">
        <span>Slug <em>(auto-generated from title)</em></span>
        <input
          v-model="form.slug"
          type="text"
          placeholder="hades"
          @input="form.slugManual = true"
        />
      </label>
      <p class="field-hint">Preview: /soundtrack/{{ form.slug || "…" }}</p>
    </section>

    <!-- ── Cover ─────────────────────────────────────────────────────────── -->
    <section class="form-section">
      <h2 class="section-title">Cover Images</h2>
      <div class="field-grid">
        <label class="field">
          <span>Cover Image URL</span>
          <input v-model="form.cover_image_url" type="url" placeholder="https://…" />
        </label>
        <label class="field">
          <span>Cover Image URL (HD)</span>
          <input v-model="form.cover_image_url_hd" type="url" placeholder="https://…" />
        </label>
      </div>
      <div v-if="form.cover_image_url" class="cover-preview">
        <img :src="form.cover_image_url" alt="Cover preview" />
      </div>
    </section>

    <!-- ── YouTube ───────────────────────────────────────────────────────── -->
    <section class="form-section">
      <h2 class="section-title">YouTube</h2>
      <div class="field-grid">
        <div class="field-with-preview">
          <label class="field">
            <span>
              Playlist ID
              <a v-if="playlistUrl" :href="playlistUrl" target="_blank" rel="noopener" class="open-link">Open ↗</a>
              <a v-if="playlistSearchUrl" :href="playlistSearchUrl" target="_blank" rel="noopener" class="open-link">Search ↗</a>
            </span>
            <input v-model="form.youtube_playlist_id" type="text" placeholder="PLxxxxxxx" spellcheck="false" />
          </label>
          <p class="resolved" :class="`resolved--${resolved.playlist.status}`">
            <template v-if="resolved.playlist.status === 'ok'">{{ resolved.playlist.title }}</template>
            <template v-else-if="resolved.playlist.status === 'error'">{{ resolved.playlist.error }}</template>
            <template v-else-if="resolved.playlist.status === 'loading'">Checking…</template>
            <template v-else>Not set</template>
          </p>
        </div>

        <div class="field-with-preview">
          <label class="field">
            <span>
              Video ID
              <a v-if="videoUrl" :href="videoUrl" target="_blank" rel="noopener" class="open-link">Open ↗</a>
              <a v-if="videoSearchUrl" :href="videoSearchUrl" target="_blank" rel="noopener" class="open-link">Search ↗</a>
            </span>
            <input v-model="form.youtube_video_id" type="text" placeholder="dQw4w9WgXcQ" spellcheck="false" />
          </label>
          <p class="resolved" :class="`resolved--${resolved.video.status}`">
            <template v-if="resolved.video.status === 'ok'">{{ resolved.video.title }}</template>
            <template v-else-if="resolved.video.status === 'error'">{{ resolved.video.error }}</template>
            <template v-else-if="resolved.video.status === 'loading'">Checking…</template>
            <template v-else>Not set</template>
          </p>
        </div>
      </div>
    </section>

    <!-- ── Spotify ───────────────────────────────────────────────────────── -->
    <section class="form-section">
      <h2 class="section-title">Spotify</h2>
      <div class="field-with-preview">
        <div class="field-grid">
          <label class="field">
            <span>
              Spotify ID
              <a v-if="spotifyUrl" :href="spotifyUrl" target="_blank" rel="noopener" class="open-link">Open ↗</a>
              <a v-if="spotifySearchUrl" :href="spotifySearchUrl" target="_blank" rel="noopener" class="open-link">Search ↗</a>
            </span>
            <input v-model="form.spotify_id" type="text" placeholder="6rqhFgbbKwnb9MLmUQDhG6" spellcheck="false" />
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
        <p class="resolved" :class="`resolved--${resolved.spotify.status}`">
          <template v-if="resolved.spotify.status === 'ok'">{{ resolved.spotify.title }}</template>
          <template v-else-if="resolved.spotify.status === 'error'">{{ resolved.spotify.error }}</template>
          <template v-else-if="resolved.spotify.status === 'loading'">Checking…</template>
          <template v-else>Not set</template>
        </p>
      </div>
    </section>

    <!-- ── Amazon ────────────────────────────────────────────────────────── -->
    <section class="form-section">
      <h2 class="section-title">Amazon</h2>
      <div class="field-grid">
        <label class="field">
          <span>Amazon URL</span>
          <input v-model="form.amazon_url" type="url" placeholder="https://amazon.com/…" />
        </label>
        <label class="field">
          <span>Amazon Image URL</span>
          <input v-model="form.amazon_image_url" type="url" placeholder="https://…" />
        </label>
      </div>
    </section>

    <!-- ── Tags ──────────────────────────────────────────────────────────── -->
    <section class="form-section">
      <h2 class="section-title">Tags <em>(comma-separated)</em></h2>
      <div class="field-grid">
        <label class="field">
          <span>Genre Tags</span>
          <input v-model="form.genre_tags" type="text" placeholder="role-playing (rpg), adventure" />
        </label>
        <label class="field">
          <span>Theme Tags</span>
          <input v-model="form.theme_tags" type="text" placeholder="fantasy, dark" />
        </label>
        <label class="field">
          <span>Keyword Tags</span>
          <input v-model="form.keyword_tags" type="text" placeholder="boss music, ambient" />
        </label>
      </div>
    </section>

    <!-- ── Streaming Links ───────────────────────────────────────────────── -->
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

    <!-- ── Submit ────────────────────────────────────────────────────────── -->
    <div class="form-footer">
      <p v-if="error" class="msg msg--error">{{ error }}</p>
      <p v-if="success" class="msg msg--success">{{ success }} — redirecting…</p>
      <button type="submit" class="submit-btn" :disabled="saving">
        {{ saving ? "Saving…" : "Insert Soundtrack" }}
      </button>
    </div>

  </form>
</template>

<style scoped>
.add-form {
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.form-section {
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Import from IGDB ─────────────────────────────────────────────────────── */
.import-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem 1.25rem 1.5rem;
  margin-bottom: 0.5rem;
}

.import-search {
  display: flex;
  gap: 0.5rem;
}

.import-search input {
  flex: 1;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.5rem 0.7rem;
  font-size: 0.9rem;
  color: var(--text-primary);
  font-family: inherit;
}

.import-search input:focus {
  outline: none;
  border-color: var(--accent);
}

.import-search-btn {
  flex-shrink: 0;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.import-search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-or {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.import-or::before,
.import-or::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

.surprise-btn {
  align-self: stretch;
  background: var(--card);
  color: var(--text-primary);
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.surprise-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.surprise-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.igdb-results {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.igdb-result {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
}

.igdb-result--existing {
  opacity: 0.6;
}

.igdb-thumb {
  width: 46px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.igdb-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.igdb-thumb-fallback {
  font-size: 1.2rem;
}

.igdb-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.igdb-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.igdb-meta {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.igdb-genres {
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.igdb-action {
  flex-shrink: 0;
}

.igdb-import-btn {
  background: var(--surface-2);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.igdb-import-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.igdb-import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.igdb-existing-badge {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.3rem 0.55rem;
  white-space: nowrap;
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
  color: var(--text-muted);
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

.field--full {
  width: 100%;
}

.field em {
  font-style: normal;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.field input,
.field select,
.field textarea {
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

.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.field textarea {
  resize: vertical;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

.cover-preview img {
  height: 100px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid var(--border);
}

/* Link fields with a live resolved-title preview underneath */
.field-with-preview {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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

.resolved {
  margin: 0;
  font-size: 0.8rem;
  padding: 0.4rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
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
  color: var(--text-muted);
}

.link-row {
  display: grid;
  grid-template-columns: 140px 1fr 160px 28px;
  gap: 0.5rem;
  align-items: center;
}

.link-row input,
.link-row select {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
  color: var(--text-primary);
  font-family: inherit;
}

.remove-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.25rem;
}

.remove-btn:hover {
  color: #f87171;
}

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

.add-link-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.form-footer {
  padding-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.msg {
  font-size: 0.875rem;
  margin: 0;
  padding: 0.6rem 0.9rem;
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

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
