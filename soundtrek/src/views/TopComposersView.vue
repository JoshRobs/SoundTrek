<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { storeToRefs } from 'pinia'
import { useSoundtrackStore } from '@/stores/soundtracks'
import PageHero from '@/components/PageHero.vue'
import TopComposerRow from '@/components/TopComposerRow.vue'

const store = useSoundtrackStore()
const { allSoundtracks, loading, error } = storeToRefs(store)

useHead({
  title: 'Top Composers | SoundTrek',
  meta: [
    { name: 'description', content: 'The most celebrated video game composers on SoundTrek, ranked by popularity.' },
    { property: 'og:title', content: 'Top Composers | SoundTrek' },
    { property: 'og:description', content: 'The most celebrated video game composers on SoundTrek, ranked by popularity.' },
    { property: 'og:url', content: 'https://soundtrek.app/top-composers' },
  ],
})

const composers = computed(() => {
  const map = new Map<string, { trackCount: number; totalLikes: number }>()
  for (const s of allSoundtracks.value) {
    for (const c of s.composers ?? []) {
      const entry = map.get(c) ?? { trackCount: 0, totalLikes: 0 }
      entry.trackCount++
      entry.totalLikes += s.likes
      map.set(c, entry)
    }
  }
  return [...map.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.totalLikes - a.totalLikes)
})

onMounted(() => store.loadAll())
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero label="Charts" title="Top Composers" subtitle="Ranked by total community likes" />

      <div v-if="loading" class="loading">
        <div class="spinner" />
        <span>Loading…</span>
      </div>

      <div v-else-if="error" class="error">{{ error }}</div>

      <ol v-else class="composer-list">
        <TopComposerRow
          v-for="(c, i) in composers"
          :key="c.name"
          :rank="i + 1"
          :name="c.name"
          :track-count="c.trackCount"
          :total-likes="c.totalLikes"
        />
      </ol>
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

@media (max-width: 768px) {
  .page-inner {
    padding: 0 1rem 3rem;
  }
}

.composer-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.composer-list > li + li {
  border-top: 1px solid var(--border);
}

.composer-list > li:hover + li {
  border-top-color: transparent;
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

.error { padding: 2rem; color: #f87171; font-size: 0.9rem; }

.spinner {
  --spinner-size: 20px;
  width: var(--spinner-size);
  height: var(--spinner-size);
}
</style>
