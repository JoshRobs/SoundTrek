<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useHead } from "@unhead/vue";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { useComposerStore } from "@/stores/composers";
import { displayLikes } from "@/utils/likes";
import PageHero from "@/components/PageHero.vue";
import TopComposerRow from "@/components/TopComposerRow.vue";

const store = useSoundtrackStore();
const composerStore = useComposerStore();
const { allSoundtracks, loading, error } = storeToRefs(store);

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

const composers = computed(() => {
  const map = new Map<string, { trackCount: number; totalLikes: number }>();
  for (const s of allSoundtracks.value) {
    for (const c of s.composers ?? []) {
      const entry = map.get(c) ?? { trackCount: 0, totalLikes: 0 };
      entry.trackCount++;
      entry.totalLikes += displayLikes(s);
      map.set(c, entry);
    }
  }
  return [...map.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.totalLikes - a.totalLikes);
});

onMounted(async () => {
  await store.loadAll();
  const all = await composerStore.fetchAll();
  for (const c of all) imageMap.value.set(c.name, c.image_url ?? null);
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

      <div v-if="loading" class="loading">
        <div class="spinner" />
        <span>Loading…</span>
      </div>

      <div v-else-if="error" class="error">{{ error }}</div>

      <div v-else class="composer-grid">
        <TopComposerRow
          v-for="(c, i) in composers"
          :key="c.name"
          :rank="i + 1"
          :name="c.name"
          :track-count="c.trackCount"
          :total-likes="c.totalLikes"
          :image-url="imageMap.get(c.name) ?? null"
        />
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

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 0;
  color: var(--text-muted);
  font-size: 0.85rem;
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
