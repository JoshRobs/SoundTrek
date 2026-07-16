<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { useHead } from "@unhead/vue";
import { supabase } from "@/lib/supabase";
import { useComposerStore } from "@/stores/composers";
import { useInfiniteScroll } from "@/composables/useInfiniteScroll";
import { toSlug } from "@/utils/slug";
import PageHero from "@/components/PageHero.vue";
import TopComposerRow from "@/components/TopComposerRow.vue";

type ComposerStat = { name: string; track_count: number; total_likes: number };

const composerStore = useComposerStore();
const imageMap = ref(new Map<string, string | null>());

useHead({
  title: "Top Composers | SoundTrek",
  meta: [
    {
      name: "description",
      content:
        "The most celebrated video game composers on SoundTrek, ranked by popularity.",
    },
    { property: "og:title", content: "Top Composers | SoundTrek" },
    {
      property: "og:description",
      content:
        "The most celebrated video game composers on SoundTrek, ranked by popularity.",
    },
    { property: "og:url", content: "https://soundtrek.app/top-composers" },
  ],
});

const PAGE_SIZE = 20;
const composers = ref<ComposerStat[]>([]);
const error = ref<string | null>(null);
const sentinelEl = useTemplateRef<HTMLElement>("sentinel");

async function loadImages(page: ComposerStat[]) {
  const slugByName = new Map(page.map((c) => [toSlug(c.name), c.name]));
  await composerStore.fetchMany([...slugByName.keys()]);
  for (const [slug, name] of slugByName) {
    imageMap.value.set(name, composerStore.cache.get(slug)?.image_url ?? null);
  }
}

const { loading, exhausted } = useInfiniteScroll(sentinelEl, async () => {
  const from = composers.value.length;
  const { data, error: err } = await supabase
    .from("composer_stats")
    .select("*")
    .order("total_likes", { ascending: false })
    .order("name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (err) {
    error.value = err.message;
    return false;
  }
  const page = data ?? [];
  composers.value.push(...page);
  loadImages(page);
  return page.length >= PAGE_SIZE;
});
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero
        label="Charts"
        title="Top Composers"
        subtitle="Ranked by total community likes"
      />

      <div v-if="error" class="error">{{ error }}</div>

      <div class="composer-grid">
        <TopComposerRow
          v-for="(c, i) in composers"
          :key="c.name"
          :rank="i + 1"
          :name="c.name"
          :track-count="c.track_count"
          :total-likes="c.total_likes"
          :image-url="imageMap.get(c.name) ?? null"
        />
      </div>

      <div ref="sentinel" class="sentinel">
        <div v-if="loading" class="loading">
          <div class="spinner" />
          <span>Loading…</span>
        </div>
        <p v-else-if="exhausted && composers.length > 0" class="end-note">
          You've seen all {{ composers.length }} composers
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
}

.page-inner {
  max-width: 1250px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 4rem;
}

.composer-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-auto-rows: auto;
  gap: 2rem;
  align-items: stretch;
}

@media (max-width: 1024px) {
  .composer-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .page-inner {
    padding: 0 1rem 3rem;
  }
  .composer-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .composer-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.sentinel {
  padding: 2rem 0;
  display: flex;
  justify-content: center;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.end-note {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.error {
  padding: 2rem;
  color: #f87171;
  font-size: 0.9rem;
}

.spinner {
  --spinner-size: 20px;
  width: var(--spinner-size);
  height: var(--spinner-size);
}
</style>
