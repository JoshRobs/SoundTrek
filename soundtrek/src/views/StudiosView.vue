<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useHead } from "@unhead/vue";
import { storeToRefs } from "pinia";
import { RouterLink } from "vue-router";
import { useSoundtrackStore } from "@/stores/soundtracks";
import PageHero from "@/components/PageHero.vue";
import { toSlug } from "@/utils/slug";

const store = useSoundtrackStore();
const { allSoundtracks, loading, error } = storeToRefs(store);

useHead({
  title: "Studios | SoundTrek",
  meta: [
    { name: "description", content: "Browse all game studios on SoundTrek." },
    { property: "og:title", content: "Studios | SoundTrek" },
    { property: "og:url", content: "https://soundtrek.app/studios" },
  ],
});

const studios = computed(() => {
  const map = new Map<string, number>();
  for (const s of allSoundtracks.value) {
    map.set(s.studio, (map.get(s.studio) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

onMounted(() => store.loadAll());
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero label="Browse" title="Studios" subtitle="All studios alphabetically" />

      <div v-if="loading" class="loading">
        <div class="spinner" />
        <span>Loading…</span>
      </div>

      <div v-else-if="error" class="error">{{ error }}</div>

      <ul v-else class="studio-list">
        <li v-for="s in studios" :key="s.name" class="studio-row">
          <RouterLink :to="`/studio/${toSlug(s.name)}`" class="studio-link">
            <span class="studio-name">{{ s.name }}</span>
            <span class="studio-count">{{ s.count }} {{ s.count === 1 ? "OST" : "OSTs" }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
}

.page-inner {
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 4rem;
}

.studio-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.studio-row {
  border-top: 1px solid var(--border);
}

.studio-row:last-child {
  border-bottom: 1px solid var(--border);
}

.studio-row:hover + .studio-row {
  border-top-color: transparent;
}

.studio-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0.75rem;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.12s;
}

.studio-link:hover {
  background: var(--surface-2);
}

.studio-name {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-primary);
}

.studio-count {
  font-size: 0.78rem;
  color: var(--text-muted);
  flex-shrink: 0;
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

@media (max-width: 768px) {
  .page-inner {
    padding: 0 1rem 3rem;
  }

  .studio-link {
    padding: 0.7rem 0.5rem;
  }
}
</style>
