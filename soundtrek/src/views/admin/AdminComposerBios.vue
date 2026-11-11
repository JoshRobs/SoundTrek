<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { supabase } from "@/lib/supabase";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { toSlug } from "@/utils/slug";
import { usePersistentSet } from "@/composables/usePersistentSet";

const { allSoundtracks } = storeToRefs(useSoundtrackStore());

// ── Queue: composers with no bio or image in the composers table ──────────────

interface ComposerRow {
  bio: string | null;
  image_url: string | null;
}

const existing = ref(new Map<string, ComposerRow>());
const loadedExisting = ref(false);
// Names of composers-table rows, so search also finds composers that no
// longer appear on any soundtrack.
const tableNames = ref<string[]>([]);

onMounted(async () => {
  const { data } = await supabase
    .from("composers")
    .select("slug, name, bio, image_url");
  const rows = (data ?? []) as Array<
    { slug: string; name: string | null } & ComposerRow
  >;
  existing.value = new Map(
    rows.map((c) => [c.slug, { bio: c.bio, image_url: c.image_url }]),
  );
  tableNames.value = rows.map((c) => c.name).filter((n): n is string => !!n);
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

const { set: skipped, clear: clearSkipped } = usePersistentSet("composer-bios-skipped");
const queueHead = computed(
  () => queue.value.find((n) => !skipped.value.has(n)) ?? null,
);

// ── Search: pin any composer (even ones with a bio) for editing ───────────────

const pinned = ref<string | null>(null);
const selected = computed(() => pinned.value ?? queueHead.value);

const searchQuery = ref("");
const searchOpen = ref(false);
const searchActive = ref(0);

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

// Every known composer, one entry per slug (soundtrack credits win over the
// table's stored name so the name matches what soundtracks reference).
const allComposerNames = computed(() => {
  const bySlug = new Map<string, string>();
  for (const s of allSoundtracks.value)
    for (const name of s.composers ?? [])
      if (!bySlug.has(toSlug(name))) bySlug.set(toSlug(name), name);
  for (const name of tableNames.value)
    if (!bySlug.has(toSlug(name))) bySlug.set(toSlug(name), name);
  return [...bySlug.values()];
});

const searchResults = computed(() => {
  const q = normalize(searchQuery.value);
  if (!q) return [];
  return allComposerNames.value
    .map((name) => {
      const n = normalize(name);
      const idx = n.indexOf(q);
      return { name, idx, startsWord: idx === 0 || n[idx - 1] === " " };
    })
    .filter((r) => r.idx !== -1)
    .sort(
      (a, b) =>
        Number(b.startsWord) - Number(a.startsWord) ||
        (composerLikes.value.get(b.name) ?? 0) -
          (composerLikes.value.get(a.name) ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 10)
    .map((r) => r.name);
});

watch(searchResults, () => (searchActive.value = 0));

function hasBio(name: string) {
  return !!existing.value.get(toSlug(name))?.bio;
}

function pick(name: string) {
  pinned.value = name;
  savedNote.value = null;
  searchQuery.value = "";
  searchOpen.value = false;
}

function onSearchKey(e: KeyboardEvent) {
  const n = searchResults.value.length;
  if (e.key === "ArrowDown" && n) {
    e.preventDefault();
    searchOpen.value = true;
    searchActive.value = (searchActive.value + 1) % n;
  } else if (e.key === "ArrowUp" && n) {
    e.preventDefault();
    searchActive.value = (searchActive.value - 1 + n) % n;
  } else if (e.key === "Enter" && n) {
    e.preventDefault();
    pick(searchResults.value[searchActive.value]);
  } else if (e.key === "Escape") {
    searchOpen.value = false;
  }
}

function backToQueue() {
  pinned.value = null;
  savedNote.value = null;
}

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
const skippedCount = computed(() => queue.value.length - remaining.value);

function skip() {
  if (queueHead.value) skipped.value.add(queueHead.value);
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

// Wikimedia only renders thumbnails at a fixed set of widths — an arbitrary
// one like 512px returns HTTP 400 — so use the original when it's already
// small, else the standard 500px step.
const WIKI_IMAGE_WIDTH = 500;

function wikiImageUrl(data: {
  thumbnail?: { source: string };
  originalimage?: { source: string; width: number };
}): string | null {
  const strip = (u: string) => u.split("?")[0]; // drop the API's utm_* tags
  const orig = data.originalimage;
  if (orig && orig.width <= WIKI_IMAGE_WIDTH) return strip(orig.source);
  const thumb = data.thumbnail?.source;
  if (thumb) return strip(thumb).replace(/\/\d+px-/, `/${WIKI_IMAGE_WIDTH}px-`);
  return orig ? strip(orig.source) : null;
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
    originalimage?: { source: string; width: number };
  };
  if (data.type === "disambiguation") return { bio: null, imageUrl: null };
  return { bio: data.extract ?? null, imageUrl: wikiImageUrl(data) };
}

// Wikidata P18 ("image") — the curated portrait, often present when the
// article has no lead image.
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
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${WIKI_IMAGE_WIDTH}`;
}

// ── Image candidates ──────────────────────────────────────────────────────────
// Look Up gathers photos from several sources; the admin picks one.

interface ImageOption {
  url: string;
  source: string;
  detail?: string;
}

const imageOptions = ref<ImageOption[]>([]);
const brokenOptions = ref(new Set<string>());
const visibleOptions = computed(() =>
  imageOptions.value.filter((o) => !brokenOptions.value.has(o.url)),
);

const proxyUrl = import.meta.env.VITE_YOUTUBE_PROXY_URL as string | undefined;

// Deezer artist photos (1000×1000), via the worker. Exact name matches only
// when there are any — the search also returns collaborations ("A & B") and
// near-namesakes. Otherwise the closest two, labelled with Deezer's name so a
// wrong person is easy to spot.
async function fetchDeezerOptions(name: string): Promise<ImageOption[]> {
  if (!proxyUrl) throw new Error("VITE_YOUTUBE_PROXY_URL is not configured");
  const res = await fetch(`${proxyUrl}/deezer-artists?q=${encodeURIComponent(name)}`);
  if (res.status === 404) throw new Error("the worker has no /deezer-artists route yet — redeploy it");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const { results } = (await res.json()) as {
    results: { id: number; name: string; fans: number; picture: string }[];
  };
  const slug = toSlug(name);
  const exact = results.filter((a) => toSlug(a.name) === slug);
  const picks = (exact.length ? exact : results.slice(0, 2))
    .sort((a, b) => b.fans - a.fans)
    .slice(0, 3);
  const fans = (n: number) => `${n.toLocaleString()} fan${n === 1 ? "" : "s"}`;
  return picks.map((a) => ({
    url: a.picture,
    source: "Deezer",
    detail: exact.length ? fans(a.fans) : `“${a.name}” · ${fans(a.fans)}`,
  }));
}

function pickImage(url: string) {
  imageUrl.value = url;
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
  imageOptions.value = [];
  brokenOptions.value = new Set();

  const problems: string[] = [];

  // Deezer runs alongside the Wikipedia chain.
  const deezer = fetchDeezerOptions(name).catch((e: unknown) => {
    problems.push(`Deezer: ${e instanceof Error ? e.message : "failed"}`);
    return [] as ImageOption[];
  });

  const wiki = (async (): Promise<ImageOption[]> => {
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
    if (token !== lookupToken) return [];
    if (!title) {
      problems.push("No Wikipedia page found");
      return [];
    }

    wikiTitle.value = title;
    wikiSource.value = source;

    const [summary, portrait] = await Promise.all([
      fetchWikiSummary(title),
      fetchWikidataImage(title).catch(() => null),
    ]);
    if (token !== lookupToken) return [];

    // Only fill a bio that's still empty — an existing one is kept.
    if (!bio.value && summary.bio) bio.value = summary.bio;
    if (!summary.bio) problems.push("Wikipedia page has no extract");

    const options: ImageOption[] = [];
    if (summary.imageUrl)
      options.push({ url: summary.imageUrl, source: "Wikipedia", detail: "lead image" });
    if (portrait)
      options.push({ url: portrait, source: "Wikidata", detail: "portrait" });
    return options;
  })().catch((e: unknown) => {
    problems.push(`Wikipedia: ${e instanceof Error ? e.message : "failed"}`);
    return [] as ImageOption[];
  });

  try {
    const [deezerOptions, wikiOptions] = await Promise.all([deezer, wiki]);
    if (token !== lookupToken) return;

    // Wikipedia's lead image and the Wikidata portrait are often one file.
    const fileOf = (u: string) =>
      decodeURIComponent(u.split("?")[0].split("/").pop() ?? "")
        .replace(/^\d+px-/, "")
        .replace(/ /g, "_");
    const seen = new Set<string>();
    imageOptions.value = [...deezerOptions, ...wikiOptions].filter((o) => {
      const key = o.source === "Deezer" ? o.url : fileOf(o.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!imageOptions.value.length) problems.push("no image candidates found");
    if (problems.length) lookupError.value = problems.join(" · ");
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
    imageOptions.value = [];
    brokenOptions.value = new Set();
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
  // A searched-for composer stays open after saving; queue items advance.
  savedNote.value = pinned.value
    ? `Saved ${name}`
    : `Saved ${name} — ${remaining.value} remaining`;
}

const wikiUrl = computed(() =>
  wikiTitle.value
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.value)}`
    : null,
);

const googleImagesUrl = computed(() =>
  selected.value
    ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`"${selected.value}" composer`)}`
    : "#",
);

const googleUrl = computed(() =>
  selected.value
    ? `https://www.google.com/search?q=${encodeURIComponent(selected.value + " video game composer")}`
    : "#",
);
</script>

<template>
  <div class="page">
    <div class="search">
      <input
        v-model="searchQuery"
        type="search"
        class="search-input"
        placeholder="Search any composer to edit…"
        spellcheck="false"
        autocomplete="off"
        @focus="searchOpen = true"
        @input="searchOpen = true"
        @blur="searchOpen = false"
        @keydown="onSearchKey"
      />
      <ul
        v-if="searchOpen && searchQuery.trim()"
        class="search-results"
        role="listbox"
      >
        <li
          v-for="(name, i) in searchResults"
          :key="name"
          role="option"
          :aria-selected="i === searchActive"
          :class="['search-item', { 'search-item--active': i === searchActive }]"
          @mousedown.prevent="pick(name)"
          @mouseenter="searchActive = i"
        >
          <span class="search-name">{{ name }}</span>
          <span class="search-meta">
            {{ soundtrackCounts.get(name) ?? 0 }} OST
            <span
              :class="['status-dot', hasBio(name) ? 'status-dot--ok' : '']"
              :title="hasBio(name) ? 'Has bio' : 'Missing bio'"
            />
          </span>
        </li>
        <li v-if="!searchResults.length" class="search-empty">
          No composers match “{{ searchQuery.trim() }}”
        </li>
      </ul>
    </div>

    <div class="queue-bar">
      <template v-if="pinned">
        <span class="queue-count">Editing a searched composer</span>
        <span v-if="savedNote" class="saved-note">{{ savedNote }}</span>
        <button class="btn btn--ghost" @click="backToQueue">
          ← Back to queue
        </button>
      </template>
      <template v-else>
        <span class="queue-count">
          {{ remaining }} composer{{ remaining !== 1 ? "s" : "" }} missing a
          bio or image
        </span>
        <span v-if="savedNote" class="saved-note">{{ savedNote }}</span>
        <button v-if="skippedCount" class="btn btn--ghost" @click="clearSkipped">
          Un-skip {{ skippedCount }}
        </button>
        <button class="btn btn--ghost" :disabled="!queueHead" @click="skip">
          Skip →
        </button>
      </template>
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
            <div v-if="visibleOptions.length" class="image-options">
              <span class="options-label">Pick an image</span>
              <div class="options-grid">
                <button
                  v-for="o in visibleOptions"
                  :key="o.url"
                  type="button"
                  class="image-option"
                  :class="{ 'image-option--selected': imageUrl === o.url }"
                  :title="o.url"
                  @click="pickImage(o.url)"
                >
                  <img
                    :src="o.url"
                    :alt="`${o.source} image`"
                    referrerpolicy="no-referrer"
                    loading="lazy"
                    @error="brokenOptions.add(o.url)"
                  />
                  <span class="option-source">{{ o.source }}</span>
                  <span v-if="o.detail" class="option-detail">{{ o.detail }}</span>
                </button>
              </div>
            </div>
            <label class="field">
              <span>
                Image URL
                <a
                  :href="googleImagesUrl"
                  target="_blank"
                  rel="noopener"
                  class="open-link"
                  >Google Images ↗</a
                >
              </span>
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
            {{ saving ? "Saving…" : pinned ? "Save" : "Apply & Next" }}
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

/* Search */
.search {
  position: relative;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-family: inherit;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.search-results {
  position: absolute;
  z-index: 10;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  max-height: 320px;
  overflow-y: auto;
}

.search-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.search-item--active {
  background: var(--surface-2);
  color: var(--text-primary);
}

.search-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  font-size: 0.72rem;
  color: #ffffff77;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f87171;
}

.status-dot--ok {
  background: #4ade80;
}

.search-empty {
  padding: 0.5rem 0.7rem;
  font-size: 0.82rem;
  color: #ffffff77;
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

/* Image candidates from Look Up */
.image-options {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.options-label {
  font-size: 0.82rem;
  color: var(--text-secondary);
}
.options-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.image-option {
  width: 112px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.2rem;
  padding: 0.35rem;
  background: var(--surface-2);
  border: 2px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  text-align: left;
  color: inherit;
}
.image-option:hover {
  border-color: var(--accent-light);
}
.image-option--selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.35);
}
.image-option img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 5px;
  background: var(--surface);
}
.option-source {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}
.option-detail {
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
