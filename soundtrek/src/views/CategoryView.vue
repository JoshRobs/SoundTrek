<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { toSlug } from '@/utils/slug'
import { displayLikes } from '@/utils/likes'
import PageHero from '@/components/PageHero.vue'
import SortBar from '@/components/SortBar.vue'
import CategoryGridCard from '@/components/CategoryGridCard.vue'
import type { Soundtrack } from '@/types/soundtrack'

const route = useRoute()

const sort  = ref<'popular' | 'newest' | 'oldest' | 'az'>('popular')
const indie = ref(false)
const loading = ref(true)

const type = computed(() => route.params.type as string)
const slug = computed(() => route.params.slug as string)

function getTags(s: Soundtrack, t: string): string[] {
  if (t === 'genre')   return s.genre_tags  ?? []
  if (t === 'theme')   return s.theme_tags  ?? []
  if (t === 'console') return [s.console]
  return []
}

// Column that holds the tag being browsed — only that narrow column is
// fetched across the table to resolve the slug to its display name,
// instead of loading every full soundtrack row.
const tagColumn = computed(() =>
  type.value === 'genre' ? 'genre_tags' : type.value === 'theme' ? 'theme_tags' : 'console',
)

const categoryName = ref('')
const baseItems = ref<Soundtrack[]>([])

watch(
  [type, slug],
  async () => {
    loading.value = true

    const { data: tagRows } = await supabase
      .from('soundtracks')
      .select(tagColumn.value)
      .returns<Pick<Soundtrack, 'genre_tags' | 'theme_tags' | 'console'>[]>()

    let name = slug.value
    outer: for (const row of tagRows ?? []) {
      for (const tag of getTags(row as Soundtrack, type.value)) {
        if (toSlug(tag) === slug.value) { name = tag; break outer }
      }
    }
    categoryName.value = name

    const query = supabase.from('soundtracks').select('*')
    if (type.value === 'genre') query.contains('genre_tags', [name])
    else if (type.value === 'theme') query.contains('theme_tags', [name])
    else query.eq('console', name)

    const { data } = await query
    baseItems.value = data ?? []
    loading.value = false
  },
  { immediate: true },
)

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
  const map: Record<string, string> = { genre: 'Genre', theme: 'Theme', console: 'Console' }
  return map[type.value] ?? type.value
})

const sortedItems = computed(() => {
  let items = indie.value
    ? baseItems.value.filter(s => (s.genre_tags ?? []).some(t => t.toLowerCase() === 'indie'))
    : [...baseItems.value]

  switch (sort.value) {
    case 'popular': return [...items].sort((a, b) => displayLikes(b) - displayLikes(a))
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

@media (max-width: 768px) {
  .page-inner {
    padding: 0 1rem 3rem;
  }

  .grid {
    gap: 0.75rem;
  }
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
