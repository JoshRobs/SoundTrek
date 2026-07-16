<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useHead } from "@unhead/vue";
import { supabase } from "@/lib/supabase";
import type { Soundtrack } from "@/types/soundtrack";
import PageHero from "@/components/PageHero.vue";

const route = useRoute();

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

const results = ref<Soundtrack[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function runSearch() {
  const query = normalize(q.value);
  if (!query) {
    results.value = [];
    return;
  }

  loading.value = true;
  error.value = null;
  const { data, error: err } = await supabase.rpc("search_soundtracks", {
    q: q.value,
    p_limit: 50,
  });
  if (err) {
    error.value = err.message;
  } else {
    results.value = (data ?? [])
      .map((s: Soundtrack) => ({ s, score: titleScore(s.game_title, query) }))
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .map((r: { s: Soundtrack }) => r.s);
  }
  loading.value = false;
}

watch(q, runSearch, { immediate: true });

const subtitle = computed(() =>
  results.value.length
    ? `${results.value.length} soundtrack${results.value.length === 1 ? "" : "s"} found`
    : "",
);
</script>

<template>
  <div class="page">
    <div v-if="loading" class="state">
      <div class="spinner" />
      <p>Loading…</p>
    </div>

    <div v-else-if="error" class="state error">
      <p>{{ error }}</p>
    </div>

    <template v-else>
      <div class="page-inner">
        <PageHero
          label="Search"
          :title="q ? `“${q}”` : 'Search'"
          :subtitle="subtitle"
        />

        <div v-if="!q" class="state">
          <p>Enter a search term to find soundtracks.</p>
        </div>

        <div v-else-if="results.length === 0" class="state">
          <p>No soundtracks found for &ldquo;{{ q }}&rdquo;.</p>
          <RouterLink to="/discover" class="home-link">Browse all soundtracks</RouterLink>
        </div>

        <section v-else class="grid">
          <RouterLink
            v-for="s in results"
            :key="s.id"
            :to="`/soundtrack/${s.slug ?? s.id}`"
            class="grid-card"
          >
            <div class="grid-cover">
              <img
                v-if="s.cover_image_url"
                :src="s.cover_image_url"
                :alt="s.game_title"
                class="grid-img"
              />
              <div v-else class="grid-fallback">🎮</div>
            </div>
            <div class="grid-info">
              <p class="grid-title">{{ s.game_title }}</p>
              <p class="grid-meta">
                <span v-if="s.composers.length">{{ s.composers.join(", ") }}</span>
                <span class="grid-year">{{ s.release_year }}</span>
              </p>
            </div>
          </RouterLink>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.page-inner {
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}

.grid-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  cursor: pointer;
  text-decoration: none;
}

.grid-cover {
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-2);
}

.grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.grid-card:hover .grid-img {
  transform: scale(1.03);
}

.grid-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--text-muted);
}

.grid-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.grid-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.grid-meta {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  gap: 0.4rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grid-meta span + span::before {
  content: "·";
  margin-right: 0.4rem;
  opacity: 0.4;
}

.grid-year {
  color: var(--text-muted);
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
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .grid-title {
    font-size: 0.82rem;
  }

  .grid-meta {
    font-size: 0.7rem;
  }
}
</style>
