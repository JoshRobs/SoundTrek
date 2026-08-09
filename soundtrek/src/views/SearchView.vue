<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { useHead } from "@unhead/vue";
import { storeToRefs } from "pinia";
import { supabase } from "@/lib/supabase";
import { useComposerStore } from "@/stores/composers";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { toSlug } from "@/utils/slug";
import type { Soundtrack } from "@/types/soundtrack";
import PageHero from "@/components/PageHero.vue";
import CoverCard from "@/components/CoverCard.vue";

const route = useRoute();
const router = useRouter();
const composerStore = useComposerStore();
const { setNowPlaying } = useSoundtrackStore();
const { cache: composerCache } = storeToRefs(composerStore);

function navigate(s: Soundtrack) {
  router.push(`/soundtrack/${s.slug ?? s.id}`);
}

const q = computed(() => (route.query.q as string | undefined)?.trim() ?? "");

useHead(computed(() => ({
  title: q.value ? `"${q.value}" — Search | SoundTrek` : "Search | SoundTrek",
})));

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function titleScore(title: string, query: string): number {
  const t = normalize(title);
  if (t === query) return 4;
  if (t.startsWith(query + " ")) return 3;
  if (t.split(" ").some((w) => w === query)) return 2;
  if (t.startsWith(query)) return 1;
  return 0;
}

interface ComposerResult {
  name: string;
  slug: string;
  count: number;
}

const results = ref<Soundtrack[]>([]);
const composerResults = ref<ComposerResult[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Bumped on every search so a slow request that resolves after a newer one
// can't overwrite fresher results (or clear a spinner it no longer owns).
let searchToken = 0;

async function runSearch() {
  const query = normalize(q.value);
  if (!query) {
    searchToken++;
    results.value = [];
    composerResults.value = [];
    error.value = null;
    loading.value = false;
    return;
  }

  const token = ++searchToken;
  loading.value = true;
  error.value = null;

  try {
    const [{ data, error: err }, { data: composers }] = await Promise.all([
      supabase.rpc("search_soundtracks", { q: q.value, p_limit: 50 }),
      supabase.rpc("search_composers", { q: q.value, p_limit: 12 }),
    ]);

    if (token !== searchToken) return;

    if (err) {
      error.value = err.message;
      results.value = [];
      composerResults.value = [];
      return;
    }

    results.value = (data ?? [])
      .map((s: Soundtrack) => ({ s, score: titleScore(s.game_title, query) }))
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .map((r: { s: Soundtrack }) => r.s);

    composerResults.value = (
      (composers as { name: string; count: number }[]) ?? []
    ).map(({ name, count }) => ({ name, slug: toSlug(name), count: Number(count) }));
    // Fetch profile images for the composer cards.
    if (composerResults.value.length) {
      composerStore.fetchMany(composerResults.value.map((c) => c.slug));
    }
  } catch (e) {
    // A dropped connection rejects rather than returning an error field —
    // without this the spinner would stay up forever on flaky mobile data.
    if (token !== searchToken) return;
    error.value =
      e instanceof Error ? e.message : "Search failed. Please try again.";
    results.value = [];
    composerResults.value = [];
  } finally {
    if (token === searchToken) loading.value = false;
  }
}

watch(q, runSearch, { immediate: true });

const subtitle = computed(() => {
  const parts: string[] = [];
  if (composerResults.value.length)
    parts.push(
      `${composerResults.value.length} composer${composerResults.value.length === 1 ? "" : "s"}`,
    );
  if (results.value.length)
    parts.push(
      `${results.value.length} soundtrack${results.value.length === 1 ? "" : "s"}`,
    );
  return parts.join(" · ");
});
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero
        label="Search"
        :title="q ? `“${q}”` : 'Search'"
        :subtitle="subtitle"
      />

      <div v-if="loading" class="state">
        <div class="spinner" />
        <p>Loading…</p>
      </div>

      <div v-else-if="error" class="state error">
        <p>{{ error }}</p>
      </div>

      <div v-else-if="!q" class="state">
        <p>Enter a search term to find soundtracks.</p>
      </div>

      <div
        v-else-if="results.length === 0 && composerResults.length === 0"
        class="state"
      >
        <p>No results found for &ldquo;{{ q }}&rdquo;.</p>
        <RouterLink to="/discover" class="home-link">Browse all soundtracks</RouterLink>
      </div>

      <template v-else>
        <!-- Composers -->
        <section v-if="composerResults.length" class="composers">
          <h2 v-if="results.length" class="section-heading">Composers</h2>
          <div class="composer-grid">
            <RouterLink
              v-for="c in composerResults"
              :key="c.slug"
              :to="`/composer/${c.slug}`"
              class="composer-card"
            >
              <div class="composer-avatar">
                <img
                  v-if="composerCache.get(c.slug)?.image_url"
                  :src="composerCache.get(c.slug)!.image_url!"
                  :alt="c.name"
                  referrerpolicy="no-referrer"
                />
                <svg
                  v-else
                  class="silhouette"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"
                  />
                </svg>
              </div>
              <div class="composer-info">
                <span class="composer-name">{{ c.name }}</span>
                <span class="composer-count">
                  {{ c.count }} soundtrack{{ c.count === 1 ? "" : "s" }}
                </span>
              </div>
            </RouterLink>
          </div>
        </section>

        <!-- Soundtracks -->
        <section v-if="results.length" class="soundtracks">
          <h2 v-if="composerResults.length" class="section-heading">
            Soundtracks
          </h2>
          <div class="grid">
            <div v-for="s in results" :key="s.id" class="card-slot">
              <CoverCard
                :soundtrack="s"
                show-info
                @click="navigate(s)"
                @play="setNowPlaying(s)"
              />
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.page-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
}

.section-heading {
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 1.5rem 0 0.75rem;
}

/* Composer results */
.composers {
  margin-top: 0.5rem;
}

.composer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.composer-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  text-decoration: none;
  transition:
    border-color 0.15s,
    transform 0.15s;
}

/* Hover-only lift, gated to real hover-capable pointers — on touch, browsers
   simulate :hover under the finger during scroll, which drags the lift down
   the list as you scroll. Mirrors the gating in CoverCard. */
@media (hover: hover) and (pointer: fine) {
  .composer-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }
}

@media (hover: none) {
  .composer-card {
    -webkit-tap-highlight-color: transparent;
  }

  .composer-card:active {
    border-color: var(--accent);
    transform: scale(0.98);
  }
}

.composer-avatar {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.composer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.composer-avatar .silhouette {
  width: 60%;
  height: 60%;
  color: var(--border);
}

.composer-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.composer-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-count {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}

/* Keep the cover a consistent 3/4 regardless of the source image's aspect, so
   rows stay aligned and missing-cover placeholders don't collapse. */
.card-slot :deep(.cover-wrap) {
  aspect-ratio: 3 / 4;
}

.state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 3rem;
}

.state.error { color: #f87171; }
.state p { margin: 0; }

.home-link {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.875rem;
}
.home-link:hover { text-decoration: underline; }

.spinner {
  --spinner-size: 28px;
  width: var(--spinner-size);
  height: var(--spinner-size);
}

@media (max-width: 768px) {
  .page-inner {
    padding: 0 1rem 3rem;
  }

  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .composer-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }

  .state {
    padding: 3rem 1rem;
  }
}

/* Three columns leaves ~90px per card on the narrowest phones — too tight for
   a cover plus two lines of text. */
@media (max-width: 480px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
