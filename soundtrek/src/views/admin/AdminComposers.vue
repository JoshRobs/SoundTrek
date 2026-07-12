<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { supabase } from "@/lib/supabase";
import { useSoundtrackStore } from "@/stores/soundtracks";
import type { Soundtrack } from "@/types/soundtrack";

interface WikiResult {
  pageTitle: string;
  pageUrl: string;
  composers: string[];
  raw: string;
}

interface MBResult {
  id: string;
  title: string;
  score: number;
  composers: string[];
  url: string;
}

const { allSoundtracks } = storeToRefs(useSoundtrackStore());

// ── Queue: soundtracks with no composers ──────────────────────────────────────

const skipped = ref(new Set<string>());
const composers = ref("");
const wikiResult = ref<WikiResult | null>(null);
const mbResults = ref<MBResult[]>([]);
const lookupError = ref<string | null>(null);
const success = ref<string | null>(null);
const looking = ref(false);
const saving = ref(false);
const saveError = ref<string | null>(null);

const queue = computed(() =>
  allSoundtracks.value.filter((s) => (s.composers ?? []).length === 0),
);

const selected = computed<Soundtrack | null>(
  () => queue.value.find((s) => !skipped.value.has(s.id)) ?? null,
);

const remaining = computed(
  () => queue.value.filter((s) => !skipped.value.has(s.id)).length,
);

watch(
  selected,
  (s) => {
    composers.value = "";
    wikiResult.value = null;
    mbResults.value = [];
    lookupError.value = null;
    success.value = null;
    if (s) composers.value = (s.composers ?? []).join(", ");
  },
  { immediate: true },
);

function skip() {
  if (selected.value) skipped.value.add(selected.value.id);
}

// ── Composers field ───────────────────────────────────────────────────────────

function applyComposers(names: string[]) {
  composers.value = names.join(", ");
}

// ── Wikipedia lookup ──────────────────────────────────────────────────────────

async function lookupWikipedia(title: string): Promise<WikiResult | null> {
  // 1. Find the article
  const searchRes = await fetch(
    `https://en.wikipedia.org/w/api.php?` +
      new URLSearchParams({
        action: "query",
        list: "search",
        format: "json",
        origin: "*",
        srsearch: `${title} video game`,
        srlimit: "3",
      }),
  );
  const searchData = await searchRes.json();
  const pageTitle: string | undefined = searchData.query?.search?.[0]?.title;
  if (!pageTitle) return null;

  // 2. Get wikitext
  const contentRes = await fetch(
    `https://en.wikipedia.org/w/api.php?` +
      new URLSearchParams({
        action: "query",
        prop: "revisions",
        format: "json",
        origin: "*",
        titles: pageTitle,
        rvprop: "content",
        rvslots: "main",
      }),
  );
  const contentData = await contentRes.json();
  const pages = contentData.query?.pages ?? {};
  const page = Object.values(pages)[0] as any;
  const wikitext: string =
    page?.revisions?.[0]?.slots?.main?.["*"] ??
    page?.revisions?.[0]?.["*"] ??
    "";

  // 3. Extract composer/music field from infobox
  const match = wikitext.match(
    /\|\s*(?:composer|music)\s*=\s*([^\n]*(?:\n(?!\|)[^\n]*)*)/i,
  );
  if (!match)
    return {
      pageTitle,
      pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
      composers: [],
      raw: "",
    };

  const raw = match[1];
  const cleaned = raw
    .replace(/\[\[(?:[^\]\|]*\|)?([^\]]+)\]\]/g, "$1") // [[Link|Name]] → Name
    .replace(
      /\{\{(?:hlist|flatlist|unbulleted list)\|([^}]+)\}\}/gi,
      (_, inner) => inner.replace(/\|/g, ","),
    ) // hlist → csv
    .replace(/\{\{[^}]*\}\}/g, "") // remove remaining templates
    .replace(/<br\s*\/?>/gi, ",") // <br> → comma
    .replace(/<[^>]+>/g, "") // strip HTML
    .replace(/\n\*/g, ",") // wiki bullets
    .replace(/\n/g, " ");

  const names = cleaned
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 60 && !/^\d+$/.test(s));

  return {
    pageTitle,
    pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
    composers: names,
    raw,
  };
}

// ── MusicBrainz lookup ────────────────────────────────────────────────────────

async function lookupMusicBrainz(title: string): Promise<MBResult[]> {
  const res = await fetch(
    `https://musicbrainz.org/ws/2/release-group?` +
      new URLSearchParams({
        query: `releasegroup:"${title}" AND secondarytype:Soundtrack`,
        inc: "artist-credits",
        fmt: "json",
        limit: "5",
      }),
    {
      headers: { "User-Agent": "SoundTrek/1.0 (jdr.joshuaroberts@gmail.com)" },
    },
  );
  const data = await res.json();
  return (data["release-groups"] ?? []).map((rg: any) => ({
    id: rg.id,
    title: rg.title,
    score: rg.score ?? 0,
    composers: (rg["artist-credit"] ?? [])
      .filter((ac: any) => ac?.artist)
      .map((ac: any) => ac.artist.name as string),
    url: `https://musicbrainz.org/release-group/${rg.id}`,
  }));
}

// ── Combined lookup ───────────────────────────────────────────────────────────

async function lookup() {
  if (!selected.value) return;
  looking.value = true;
  lookupError.value = null;
  wikiResult.value = null;
  mbResults.value = [];

  try {
    const [wiki, mb] = await Promise.allSettled([
      lookupWikipedia(selected.value.game_title),
      lookupMusicBrainz(selected.value.game_title),
    ]);

    if (wiki.status === "fulfilled") wikiResult.value = wiki.value;
    if (mb.status === "fulfilled") mbResults.value = mb.value;

    if (wiki.status === "rejected" && mb.status === "rejected") {
      lookupError.value = "Both lookups failed. Try the Google link below.";
    }
  } catch (e) {
    lookupError.value = (e as Error).message;
  } finally {
    looking.value = false;
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────

function splitComposers(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function save() {
  if (!selected.value) return;
  saving.value = false;
  success.value = null;
  saveError.value = null;

  const names = splitComposers(composers.value);
  saving.value = true;

  const { error } = await supabase
    .from("soundtracks")
    .update({ composers: names })
    .eq("id", selected.value.id);

  saving.value = false;

  if (error) {
    saveError.value = error.message;
  } else {
    // Update store so the item drops off the queue immediately
    const s = allSoundtracks.value.find((s) => s.id === selected.value?.id);
    if (s) s.composers = names;
    success.value = `Saved — ${remaining.value - 1} remaining.`;
  }
}

const googleUrl = computed(() =>
  selected.value
    ? `https://www.google.com/search?q=${encodeURIComponent(selected.value.game_title + " composers")}`
    : "#",
);
</script>

<template>
  <div class="page">
    <!-- ── Queue status ───────────────────────────────────────────────────── -->
    <div class="queue-bar">
      <span class="queue-count"
        >{{ remaining }} soundtracks without composers</span
      >
      <button class="btn btn--ghost" :disabled="!selected" @click="skip">
        Skip →
      </button>
    </div>

    <template v-if="selected">
      <!-- ── Current composers ───────────────────────────────────────────── -->
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">
            {{ selected.game_title }}
            <span class="meta-note"
              >{{ selected.studio }} · {{ selected.release_year }}</span
            >
          </h2>
          <div class="header-actions">
            <button
              class="btn btn--primary"
              :disabled="looking"
              @click="lookup"
            >
              {{ looking ? "Looking up…" : "Look Up" }}
            </button>
            <a
              :href="googleUrl"
              target="_blank"
              rel="noopener"
              class="btn btn--ghost"
            >
              Google ↗
            </a>
          </div>
        </div>

        <label class="field">
          <span>Current composers <em>(comma-separated)</em></span>
          <input
            v-model="composers"
            type="text"
            placeholder="Darren Korb, Austin Wintory"
          />
        </label>

        <div v-if="composers" class="tag-preview">
          <span
            v-for="name in splitComposers(composers)"
            :key="name"
            class="tag"
            >{{ name }}</span
          >
        </div>

        <div class="save-row">
          <button class="btn btn--primary" :disabled="saving" @click="save">
            {{ saving ? "Saving…" : "Save" }}
          </button>
          <p v-if="saveError" class="msg msg--error">{{ saveError }}</p>
          <p v-if="success" class="msg msg--success">{{ success }}</p>
        </div>
      </section>

      <!-- ── Lookup results ──────────────────────────────────────────────── -->
      <p v-if="lookupError" class="msg msg--error">{{ lookupError }}</p>

      <!-- Wikipedia -->
      <section v-if="wikiResult" class="card">
        <div class="card-header">
          <h2 class="card-title">
            Wikipedia
            <a
              :href="wikiResult.pageUrl"
              target="_blank"
              rel="noopener"
              class="source-link"
            >
              {{ wikiResult.pageTitle }} ↗
            </a>
          </h2>
          <button
            v-if="wikiResult.composers.length"
            class="btn btn--accent"
            @click="applyComposers(wikiResult!.composers)"
          >
            Apply
          </button>
        </div>

        <div v-if="wikiResult.composers.length" class="tag-preview">
          <span v-for="name in wikiResult.composers" :key="name" class="tag">{{
            name
          }}</span>
        </div>
        <p v-else class="empty">
          No composer field found on this Wikipedia article.
        </p>

        <details v-if="wikiResult.raw" class="raw-details">
          <summary>Raw wikitext</summary>
          <pre class="raw">{{ wikiResult.raw }}</pre>
        </details>
      </section>

      <!-- MusicBrainz -->
      <section v-if="mbResults.length" class="card">
        <h2 class="card-title">MusicBrainz</h2>
        <div class="mb-results">
          <div v-for="r in mbResults" :key="r.id" class="mb-row">
            <div class="mb-info">
              <a
                :href="r.url"
                target="_blank"
                rel="noopener"
                class="mb-title"
                >{{ r.title }}</a
              >
              <div v-if="r.composers.length" class="tag-preview">
                <span v-for="name in r.composers" :key="name" class="tag">{{
                  name
                }}</span>
              </div>
              <p v-else class="empty">No artist credits found.</p>
            </div>
            <button
              v-if="r.composers.length"
              class="btn btn--accent"
              @click="applyComposers(r.composers)"
            >
              Apply
            </button>
          </div>
        </div>
      </section>

      <p v-else-if="!looking && !wikiResult && !lookupError" class="hint">
        Click "Look Up" to search Wikipedia and MusicBrainz for composer data.
      </p>
    </template>

    <p v-else class="hint">No soundtracks without composers remaining.</p>
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 1rem;
}

.queue-count {
  font-size: 0.85rem;
  color: #ffffffbb;
}

.meta-note {
  font-size: 0.75rem;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: #ffffffbb;
  margin-left: 0.5rem;
}

/* Cards */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.card-title {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #ffffffbb;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.source-link {
  font-size: 0.78rem;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--accent);
  text-decoration: none;
}
.source-link:hover {
  text-decoration: underline;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

/* Field */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
}
.field em {
  font-style: normal;
  color: #ffffffbb;
  font-size: 0.75rem;
}
.field input {
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
.field input:focus {
  outline: none;
  border-color: var(--accent);
}

/* Tag preview */
.tag-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.tag {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 99px;
  padding: 0.2rem 0.65rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
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
.btn--accent {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}
.btn--ghost {
  background: var(--surface-2);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.btn--ghost:hover {
  color: var(--text-primary);
}

/* Save row */
.save-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* MusicBrainz results */
.mb-results {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.mb-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.mb-info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}
.mb-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mb-title:hover {
  text-decoration: underline;
}

/* Raw wikitext */
.raw-details {
  margin-top: 0.25rem;
}
.raw-details summary {
  font-size: 0.75rem;
  color: #ffffffbb;
  cursor: pointer;
  user-select: none;
}
.raw {
  font-size: 0.75rem;
  color: #ffffffbb;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.6rem;
  overflow-x: auto;
  white-space: pre-wrap;
  margin-top: 0.4rem;
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

.empty {
  font-size: 0.82rem;
  color: #ffffffbb;
  margin: 0;
}
.hint {
  font-size: 0.875rem;
  color: #ffffffbb;
}
</style>
