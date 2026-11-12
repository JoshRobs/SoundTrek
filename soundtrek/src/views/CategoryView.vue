<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'
import { supabase, SOUNDTRACK_LIST_COLUMNS } from '@/lib/supabase'
import { usePrerenderedState } from '@/composables/usePrerenderedState'
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
// Size of the whole category. Normally baseItems.length, but on a prerendered
// first view only the first page of items is embedded until the full list
// arrives, so the count is carried separately.
const totalCount = ref(0)

// PostgREST caps a select at 1000 rows, so both queries page through the
// table — otherwise big categories (action, adventure…) silently stop at 1000,
// and tags that only appear on later rows can't be resolved at all.
const PAGE_SIZE = 1000

// Both helpers throw on a failed query rather than treating it as "no rows",
// so a network blip can't wipe a list that's already on screen.
async function resolveCategoryName(): Promise<string> {
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: tagRows, error } = await supabase
      .from('soundtracks')
      .select(tagColumn.value)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
      .returns<Pick<Soundtrack, 'genre_tags' | 'theme_tags' | 'console'>[]>()
    if (error) throw error
    for (const row of tagRows ?? []) {
      for (const tag of getTags(row as Soundtrack, type.value)) {
        if (toSlug(tag) === slug.value) return tag
      }
    }
    if (!tagRows || tagRows.length < PAGE_SIZE) return slug.value
  }
}

async function fetchCategoryItems(name: string): Promise<Soundtrack[]> {
  const items: Soundtrack[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    // List columns only — the grid cards and the player need nothing more.
    const query = supabase.from('soundtracks').select(SOUNDTRACK_LIST_COLUMNS)
    if (type.value === 'genre') query.contains('genre_tags', [name])
    else if (type.value === 'theme') query.contains('theme_tags', [name])
    else query.eq('console', name)
    const { data, error } = await query.order('id').range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    items.push(...((data ?? []) as Soundtrack[]))
    if (!data || data.length < PAGE_SIZE) return items
  }
}

// Guards against an older request finishing after a newer one when the user
// moves between categories quickly.
let requestId = 0

/** `background`: refresh the list without showing the spinner. */
async function loadCategory({ background = false } = {}) {
  const id = ++requestId
  if (!background) loading.value = true

  try {
    const name = await resolveCategoryName()
    if (id !== requestId) return
    const items = await fetchCategoryItems(name)
    if (id !== requestId) return
    categoryName.value = name
    baseItems.value = items
    totalCount.value = items.length  } catch (err) {
    // Keep whatever is already shown (e.g. the prerendered first page).
    console.error('[category] load failed', err)
    if (id === requestId && !background && !categoryName.value)
      categoryName.value = slug.value
  } finally {
    if (id === requestId) loading.value = false
  }
}

const byPopularity = (a: Soundtrack, b: Soundtrack) => displayLikes(b) - displayLikes(a)

// Rendered in pages as the user scrolls: a big category is 1000+ cards, which
// made the page several MB and slow to render.
const CARDS_PER_PAGE = 60
const visibleCount = ref(CARDS_PER_PAGE)

// Loaded at prerender time so the static page lists the category's games.
// Only the first page (in the default popularity order) is embedded to keep
// the HTML small; the browser then fetches the full list in the background
// for sorting, filtering and scrolling.
const prerendered = usePrerenderedState('category', {
  load: loadCategory,
  capture: () => ({
    name: categoryName.value,
    total: totalCount.value,
    items: [...baseItems.value].sort(byPopularity).slice(0, CARDS_PER_PAGE),
  }),
  restore: (d) => {
    categoryName.value = d.name
    totalCount.value = d.total
    baseItems.value = d.items
    loading.value = false
  },
})

onMounted(() => {
  if (prerendered) loadCategory({ background: true })
})

watch([type, slug], () => {
  visibleCount.value = CARDS_PER_PAGE
  loadCategory()
}, {
  immediate: !prerendered && !import.meta.env.SSR,
})

watch([sort, indie], () => {
  visibleCount.value = CARDS_PER_PAGE
})

useHead(computed(() => {
  const title = `${categoryName.value} Soundtracks | SoundTrek`
  const description = `Browse ${totalCount.value || ''} ${categoryName.value} video game soundtracks on SoundTrek.`.replace(/\s+/g, ' ')
  const url = `https://soundtrek.app/category/${type.value}/${slug.value}`
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    link: [{ rel: 'canonical', href: url }],
  }
}))

const typeLabel = computed(() => {
  const map: Record<string, string> = { genre: 'Genre', theme: 'Theme', console: 'Console' }
  return map[type.value] ?? type.value
})

const sortedItems = computed(() => {
  let items = indie.value
    ? baseItems.value.filter(s => (s.genre_tags ?? []).some(t => t.toLowerCase() === 'indie'))
    : [...baseItems.value]

  switch (sort.value) {
    case 'popular': return [...items].sort(byPopularity)
    case 'newest':  return [...items].sort((a, b) => b.release_year - a.release_year)
    case 'oldest':  return [...items].sort((a, b) => a.release_year - b.release_year)
    case 'az':      return [...items].sort((a, b) => a.game_title.localeCompare(b.game_title))
    default:        return items
  }
})

const visibleItems = computed(() => sortedItems.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < sortedItems.value.length)

// Reveal the next page when the sentinel below the grid nears the viewport.
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
onMounted(() => {
  // A fresh observer after every reveal: a new observer always reports the
  // sentinel's current state, so one that's still within the margin (tall
  // screens) keeps paging. Re-observing on the same observer isn't enough —
  // Chromium skips the notification when unobserve/observe share a frame.
  watch([sentinel, visibleCount], ([el]) => {
    observer?.disconnect()
    observer = null
    if (!el) return
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore.value) visibleCount.value += CARDS_PER_PAGE
      },
      { rootMargin: '600px' },
    )
    observer.observe(el as HTMLElement)
  }, { immediate: true, flush: 'post' })
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero
        :label="typeLabel"
        :title="categoryName"
        :subtitle="`${totalCount} soundtrack${totalCount !== 1 ? 's' : ''}`"
      />

      <SortBar v-model:sort="sort" v-model:indie="indie" />

      <div v-if="loading" class="state">
        <div class="spinner" style="--spinner-size: 28px" />
      </div>

      <p v-else-if="sortedItems.length === 0" class="empty">
        No soundtracks match these filters.
      </p>

      <template v-else>
        <div class="grid">
          <CategoryGridCard
            v-for="s in visibleItems"
            :key="s.id"
            :soundtrack="s"
          />
        </div>
        <div v-if="hasMore" ref="sentinel" class="sentinel" aria-hidden="true" />
      </template>
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

.sentinel {
  height: 1px;
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
