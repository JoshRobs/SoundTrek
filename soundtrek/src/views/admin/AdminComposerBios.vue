<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { supabase } from "@/lib/supabase";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { toSlug } from "@/utils/slug";

const { allSoundtracks } = storeToRefs(useSoundtrackStore());

// ── Queue: composers with no bio or image in the composers table ──────────────

interface ComposerRow {
  bio: string | null;
  image_url: string | null;
}

const existing = ref(new Map<string, ComposerRow>());
const loadedExisting = ref(false);

onMounted(async () => {
  const { data } = await supabase
    .from("composers")
    .select("slug, bio, image_url");
  existing.value = new Map(
    (data ?? []).map((c: { slug: string } & ComposerRow) => [
      c.slug,
      { bio: c.bio, image_url: c.image_url },
    ]),
  );
  loadedExisting.value = true;
});

const soundtrackCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const s of allSoundtracks.value)
    for (const name of s.composers ?? [])
      counts.set(name, (counts.get(name) ?? 0) + 1);
  return counts;
});

// Total community likes per composer — the same popularity signal the Top
// Composers page ranks by (composer_stats.total_likes).
const composerLikes = computed(() => {
  const likes = new Map<string, number>();
  for (const s of allSoundtracks.value) {
    const l = s.total_likes ?? s.likes ?? 0;
    for (const name of s.composers ?? [])
      likes.set(name, (likes.get(name) ?? 0) + l);
  }
  return likes;
});

const queue = computed(() => {
  if (!loadedExisting.value) return [];
  // Most popular first, mirroring Top Composers: total likes desc, then name.
  const names = [
    ...new Set(allSoundtracks.value.flatMap((s) => s.composers ?? [])),
  ].sort(
    (a, b) =>
      (composerLikes.value.get(b) ?? 0) - (composerLikes.value.get(a) ?? 0) ||
      a.localeCompare(b),
  );
  return names.filter((name) => {
    const row = existing.value.get(toSlug(name));
    return !row || !row.bio;
  });
});

const skipped = ref(new Set<string>());
const selected = computed(
  () => queue.value.find((n) => !skipped.value.has(n)) ?? null,
);

// The composer's credited games, most popular first — the reference for
// judging whether a lookup hit the right person.
const selectedGames = computed(() => {
  if (!selected.value) return [];
  return allSoundtracks.value
    .filter((s) => (s.composers ?? []).includes(selected.value!))
    .sort(
      (a, b) =>
        (b.total_likes ?? b.likes ?? 0) - (a.total_likes ?? a.likes ?? 0),
    );
});
const remaining = computed(
  () => queue.value.filter((n) => !skipped.value.has(n)).length,
);

function skip() {
  if (selected.value) skipped.value.add(selected.value);
}

// ── Editable fields ───────────────────────────────────────────────────────────

const bio = ref("");
const imageUrl = ref("");
const imgBroken = ref(false);
const wikiTitle = ref<string | null>(null);
const wikiSource = ref<string | null>(null);

const looking = ref(false);
const lookupError = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);
const savedNote = ref<string | null>(null);

watch(imageUrl, () => (imgBroken.value = false));

// ── Lookup chain (ported from scripts/enrich-bios.ts) ─────────────────────────

const WIKI_HEADERS = { Accept: "application/json" };

interface MBArtist {
  id: string;
  name: string;
}
interface MBUrlRel {
  url: { resource: string };
}

// MusicBrainz's curated artist→Wikipedia links avoid wrong-person collisions.
async function mbFindWikipediaTitle(name: string): Promise<string | null> {
  const searchRes = await fetch(
    `https://musicbrainz.org/ws/2/artist?query=artist:${encodeURIComponent(`"${name}"`)}&limit=3&fmt=json`,
    { headers: WIKI_HEADERS },
  );
  if (!searchRes.ok) return null;
  const searchData = (await searchRes.json()) as { artists?: MBArtist[] };
  const artists = searchData.artists ?? [];
  if (!artists.length) return null;

  const nameLower = name.toLowerCase();
  const best =
    artists.find((a) => a.name.toLowerCase() === nameLower) ?? artists[0];

  const artistRes = await fetch(
    `https://musicbrainz.org/ws/2/artist/${best.id}?inc=url-rels&fmt=json`,
    { headers: WIKI_HEADERS },
  );
  if (!artistRes.ok) return null;
  const artistData = (await artistRes.json()) as { relations?: MBUrlRel[] };
  const relations = artistData.relations ?? [];

  const wikiRel = relations.find((r) =>
    r.url.resource.includes("en.wikipedia.org"),
  );
  if (wikiRel) {
    const match = wikiRel.url.resource.match(/\/wiki\/(.+)$/);
    if (match) return decodeURIComponent(match[1]);
  }

  const wikidataRel = relations.find((r) =>
    r.url.resource.includes("wikidata.org/wiki/"),
  );
  if (wikidataRel) {
    const qMatch = wikidataRel.url.resource.match(/\/(Q\d+)$/);
    if (qMatch) {
      const res = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qMatch[1]}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          entities?: Record<
            string,
            { sitelinks?: { enwiki?: { title: string } } }
          >;
        };
        return data.entities?.[qMatch[1]]?.sitelinks?.enwiki?.title ?? null;
      }
    }
  }

  return null;
}

async function searchWikipediaTitle(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      { headers: WIKI_HEADERS },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        type?: string;
        title?: string;
        extract?: string;
      };
      if (data.type !== "disambiguation" && data.extract)
        return data.title ?? null;
    }
  } catch {
    /* fall through to search */
  }

  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srnamespace=0&srlimit=3&format=json&origin=*`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { search?: Array<{ title: string }> };
  };
  return data.query?.search?.[0]?.title ?? null;
}

async function fetchWikiSummary(
  pageTitle: string,
): Promise<{ bio: string | null; imageUrl: string | null }> {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
    { headers: WIKI_HEADERS },
  );
  if (!res.ok) return { bio: null, imageUrl: null };
  const data = (await res.json()) as {
    extract?: string;
    type?: string;
    thumbnail?: { source: string };
  };
  if (data.type === "disambiguation") return { bio: null, imageUrl: null };
  const thumb = data.thumbnail?.source ?? null;
  return {
    bio: data.extract ?? null,
    imageUrl: thumb ? thumb.replace(/\/(\d+)px-/, "/512px-") : null,
  };
}

// Wikidata P18 ("image") — the curated portrait, for pages with no lead image.
async function fetchWikidataImage(enwikiTitle: string): Promise<string | null> {
  const res = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${encodeURIComponent(enwikiTitle)}&props=claims&format=json&origin=*`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    entities?: Record<
      string,
      {
        claims?: {
          P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }>;
        };
      }
    >;
  };
  const entity = Object.values(data.entities ?? {})[0];
  const filename = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!filename || typeof filename !== "string") return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=512`;
}

let lookupToken = 0;

async function lookup() {
  const name = selected.value;
  if (!name) return;
  const token = ++lookupToken;

  looking.value = true;
  lookupError.value = null;
  wikiTitle.value = null;
  wikiSource.value = null;

  try {
    let title: string | null = null;
    let source = "MusicBrainz";
    try {
      title = await mbFindWikipediaTitle(name);
    } catch {
      /* MB down — try Wikipedia directly */
    }
    if (!title) {
      title = await searchWikipediaTitle(name);
      source = "Wikipedia search";
    }
    if (token !== lookupToken) return;

    if (!title) {
      lookupError.value = "No Wikipedia page found — fill in manually or skip.";
      return;
    }

    wikiTitle.value = title;
    wikiSource.value = source;

    const summary = await fetchWikiSummary(title);
    if (token !== lookupToken) return;

    let img = summary.imageUrl;
    if (!img) {
      img = await fetchWikidataImage(title);
      if (token !== lookupToken) return;
    }

    // Only fill fields that are still empty — existing partial rows (e.g. a
    // bio saved earlier with no image) keep their data.
    if (!bio.value && summary.bio) bio.value = summary.bio;
    if (!imageUrl.value && img) imageUrl.value = img;

    if (!summary.bio && !img) {
      lookupError.value = "Page found, but no extract or image on it.";
    }
  } catch (e) {
    if (token === lookupToken)
      lookupError.value = e instanceof Error ? e.message : "Lookup failed";
  } finally {
    if (token === lookupToken) looking.value = false;
  }
}

watch(
  selected,
  (name) => {
    lookupToken++; // cancel any in-flight lookup
    bio.value = "";
    imageUrl.value = "";
    imgBroken.value = false;
    wikiTitle.value = null;
    wikiSource.value = null;
    lookupError.value = null;
    saveError.value = null;
    looking.value = false;
    if (!name) return;
    const row = existing.value.get(toSlug(name));
    bio.value = row?.bio ?? "";
    imageUrl.value = row?.image_url ?? "";
  },
  { immediate: true },
);

// ── Save ──────────────────────────────────────────────────────────────────────

async function save() {
  const name = selected.value;
  if (!name) return;
  saving.value = true;
  saveError.value = null;

  const row = {
    slug: toSlug(name),
    name,
    bio: bio.value.trim() || null,
    image_url: imageUrl.value.trim() || null,
  };

  const { error } = await supabase
    .from("composers")
    .upsert(row, { onConflict: "slug" });

  saving.value = false;

  if (error) {
    saveError.value = error.message;
    return;
  }

  // Update the local map — if bio+image are now both set, the composer drops
  // out of the queue and the next one is selected automatically.
  existing.value.set(row.slug, { bio: row.bio, image_url: row.image_url });
  existing.value = new Map(existing.value);
  savedNote.value = `Saved ${name} — ${remaining.value} remaining`;
}

const wikiUrl = computed(() =>
  wikiTitle.value
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.value)}`
    : null,
);

const googleUrl = computed(() =>
  selected.value
    ? `https://www.google.com/search?q=${encodeURIComponent(selected.value + " video game composer")}`
    : "#",
);
</script>

<template>
  <div class="page">
    <div class="queue-bar">
      <span class="queue-count">
        {{ remaining }} composer{{ remaining !== 1 ? "s" : "" }} missing a bio
        or image
      </span>
      <span v-if="savedNote" class="saved-note">{{ savedNote }}</span>
      <button class="btn btn--ghost" :disabled="!selected" @click="skip">
        Skip →
      </button>
    </div>

    <template v-if="selected">
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">
            {{ selected }}
            <span class="meta-note">
              {{ toSlug(selected) }} ·
              {{ soundtrackCounts.get(selected) ?? 0 }} soundtrack{{
                (soundtrackCounts.get(selected) ?? 0) !== 1 ? "s" : ""
              }}
            </span>
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

        <div v-if="selectedGames.length" class="games-line">
          <span class="games-label">Credits:</span>
          <a
            v-for="g in selectedGames.slice(0, 6)"
            :key="g.id"
            class="game-chip"
            :href="`/soundtrack/${g.slug ?? g.id}`"
            target="_blank"
            rel="noopener"
          >
            {{ g.game_title }}
            <span class="game-year">{{ g.release_year }}</span>
          </a>
          <span v-if="selectedGames.length > 6" class="games-more">
            +{{ selectedGames.length - 6 }} more
          </span>
        </div>

        <p v-if="wikiTitle" class="source-line">
          Found via {{ wikiSource }}:
          <a
            :href="wikiUrl!"
            target="_blank"
            rel="noopener"
            class="source-link"
          >
            {{ wikiTitle }} ↗
          </a>
        </p>
        <p v-if="lookupError" class="msg msg--error">{{ lookupError }}</p>

        <div class="preview-row">
          <div class="avatar-preview">
            <img
              v-if="imageUrl && !imgBroken"
              :src="imageUrl"
              :alt="selected"
              referrerpolicy="no-referrer"
              @error="imgBroken = true"
            />
            <span
              v-else-if="imgBroken"
              class="avatar-fallback avatar-fallback--broken"
            >
              image failed to load
            </span>
            <span v-else class="avatar-fallback">no image</span>
          </div>

          <div class="preview-fields">
            <label class="field">
              <span>Image URL</span>
              <input
                v-model="imageUrl"
                type="text"
                spellcheck="false"
                placeholder="https://…"
              />
            </label>
            <label class="field">
              <span>Bio</span>
              <textarea v-model="bio" rows="7" placeholder="Short biography…" />
            </label>
          </div>
        </div>

        <div class="save-row">
          <button
            class="btn btn--primary"
            :disabled="saving || looking || (!bio.trim() && !imageUrl.trim())"
            @click="save"
          >
            {{ saving ? "Saving…" : "Apply & Next" }}
          </button>
          <p v-if="saveError" class="msg msg--error">{{ saveError }}</p>
        </div>
      </section>
    </template>

    <p v-else-if="!loadedExisting" class="hint">Loading composers…</p>
    <p v-else class="hint">
      All composers have a bio and image. Nothing to do 🎉
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
}

.saved-note {
  font-size: 0.8rem;
  color: #4ade80;
  margin-left: auto;
}

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
  font-size: 1rem;
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

.header-actions {
  display: flex;
  gap: 0.5rem;
}

/* Credited games */
.games-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.games-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #ffffff77;
  margin-right: 0.15rem;
}

.game-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 0.75rem;
  text-decoration: none;
  transition:
    border-color 0.12s,
    color 0.12s;
}

.game-chip:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.game-year {
  color: #ffffff77;
  font-size: 0.7rem;
}

.games-more {
  font-size: 0.75rem;
  color: #ffffff77;
}

.source-line {
  margin: 0;
  font-size: 0.82rem;
  color: #ffffffbb;
}

.source-link {
  color: var(--accent);
  text-decoration: none;
}

.source-link:hover {
  text-decoration: underline;
}

/* Preview */
.preview-row {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}

.avatar-preview {
  flex-shrink: 0;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: 0.75rem;
  color: #ffffff77;
  text-align: center;
  padding: 0 0.75rem;
}

.avatar-fallback--broken {
  color: #f87171;
}

.preview-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.field input,
.field textarea {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.45rem 0.65rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--accent);
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

.save-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

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

.hint {
  font-size: 0.875rem;
  color: #ffffffbb;
}
</style>
