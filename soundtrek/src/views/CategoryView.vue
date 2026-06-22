<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSoundtrackStore } from '@/stores/soundtracks'
import { toSlug } from '@/utils/slug'
import PageHero from '@/components/PageHero.vue'
import SortBar from '@/components/SortBar.vue'
import CategoryGridCard from '@/components/CategoryGridCard.vue'
import type { Soundtrack } from '@/types/soundtrack'

const route = useRoute()
const store = useSoundtrackStore()
const { allSoundtracks, loading } = storeToRefs(store)
store.loadAll()

const sort  = ref<'popular' | 'newest' | 'oldest' | 'az'>('popular')
const indie = ref(false)

const type = computed(() => route.params.type as string)
const slug = computed(() => route.params.slug as string)

function getTags(s: Soundtrack, t: string): string[] {
  if (t === 'genre')   return s.genre_tags  ?? []
  if (t === 'mood')    return s.mood_tags   ?? []
  if (t === 'theme')   return s.theme_tags  ?? []
  if (t === 'console') return [s.console]
  return []
}

const categoryName = computed(() => {
  for (const s of allSoundtracks.value) {
    for (const tag of getTags(s, type.value)) {
      if (toSlug(tag) === slug.value) return tag
    }
  }
  return slug.value
})

useHead(computed(() => ({
  title: `${categoryName.value} Soundtracks | SoundTrek`,
  meta: [
    { name: 'description', content: `Browse video game soundtracks tagged with ${categoryName.value} on SoundTrek.` },
    { property: 'og:title', content: `${categoryName.value} Soundtracks | SoundTrek` },
    { property: 'og:description', content: `Browse video game soundtracks tagged with ${categoryName.value} on SoundTrek.` },
    { property: 'og:url', content: `https://soundtrek.app/category/${type.value}/${slug.value}` },
  ],
})))

const typeLabel = computed(() => {
  const map: Record<string, string> = { genre: 'Genre', mood: 'Mood', theme: 'Theme', console: 'Console' }
  return map[type.value] ?? type.value
})

const baseItems = computed(() =>
  allSoundtracks.value.filter(s => getTags(s, type.value).includes(categoryName.value)),
)

const sortedItems = computed(() => {
  let items = indie.value
    ? baseItems.value.filter(s => (s.genre_tags ?? []).some(t => t.toLowerCase() === 'indie'))
    : [...baseItems.value]

  switch (sort.value) {
    case 'popular': return [...items].sort((a, b) => b.likes - a.likes)
    case 'newest':  return [...items].sort((a, b) => b.release_year - a.release_year)
    case 'oldest':  return [...items].sort((a, b) => a.release_year - b.release_year)
    case 'az':      return [...items].sort((a, b) => a.game_title.localeCompare(b.game_title))
    default:        return items
  }
})
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero
        :label="typeLabel"
        :title="categoryName"
        :subtitle="`${baseItems.length} soundtrack${baseItems.length !== 1 ? 's' : ''}`"
      />

      <SortBar v-model:sort="sort" v-model:indie="indie" />

      <div v-if="loading" class="state">
        <div class="spinner" style="--spinner-size: 28px" />
      </div>

      <p v-else-if="sortedItems.length === 0" class="empty">
        No soundtracks match these filters.
      </p>

      <div v-else class="grid">
        <CategoryGridCard
          v-for="s in sortedItems"
          :key="s.id"
          :soundtrack="s"
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
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: 0 2rem 4rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.state {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

.empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 3rem;
  margin: 0;
}
</style>
