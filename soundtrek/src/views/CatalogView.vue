<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useHead } from '@unhead/vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSoundtrackStore } from '@/stores/soundtracks'

const store = useSoundtrackStore()
const { allSoundtracks, loading } = storeToRefs(store)

onMounted(() => store.loadAll())

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const grouped = computed(() => {
  const map = new Map<string, typeof allSoundtracks.value>()
  const sorted = [...allSoundtracks.value].sort((a, b) =>
    a.game_title.localeCompare(b.game_title, undefined, { sensitivity: 'base' })
  )
  for (const s of sorted) {
    const letter = s.game_title[0].toUpperCase()
    const key = /[A-Z]/.test(letter) ? letter : '#'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  return map
})

const activeLetters = computed(() => new Set(grouped.value.keys()))

useHead({
  title: 'Catalog | SoundTrek',
  meta: [
    { name: 'description', content: 'A complete alphabetical catalog of every video game soundtrack on SoundTrek.' },
    { property: 'og:title', content: 'Catalog | SoundTrek' },
    { property: 'og:description', content: 'A complete alphabetical catalog of every video game soundtrack on SoundTrek.' },
    { property: 'og:url', content: 'https://soundtrek.app/catalog' },
  ],
})

const sectionRefs = ref<Record<string, HTMLElement | null>>({})

function scrollTo(letter: string) {
  sectionRefs.value[letter]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="catalog-page">
    <div class="catalog-header">
      <h1 class="catalog-title">Catalog</h1>
      <p class="catalog-sub">{{ allSoundtracks.length }} soundtracks</p>
    </div>

    <nav class="letter-nav">
      <button
        v-for="l in LETTERS"
        :key="l"
        class="letter-btn"
        :class="{ active: activeLetters.has(l), inactive: !activeLetters.has(l) }"
        :disabled="!activeLetters.has(l)"
        @click="scrollTo(l)"
      >{{ l }}</button>
      <button
        v-if="activeLetters.has('#')"
        class="letter-btn"
        :class="{ active: true }"
        @click="scrollTo('#')"
      >#</button>
    </nav>

    <div v-if="loading" class="state">
      <div class="spinner" />
    </div>

    <div v-else class="catalog-body">
      <section
        v-for="[letter, tracks] in grouped"
        :key="letter"
        :ref="el => sectionRefs[letter] = el as HTMLElement"
        class="letter-section"
      >
        <h2 class="letter-heading">{{ letter }}</h2>
        <ul class="track-list">
          <li v-for="s in tracks" :key="s.id" class="track-item">
            <RouterLink :to="`/soundtrack/${s.id}`" class="track-link">
              {{ s.game_title }}
              <span class="track-meta">{{ s.composers.join(', ') || s.studio }} · {{ s.release_year }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.catalog-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 3rem 2rem 6rem;
}

.catalog-header {
  margin-bottom: 2rem;
}

.catalog-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 400;
  letter-spacing: 0.05em;
  color: var(--text-primary);
  line-height: 1;
  margin: 0 0 0.25rem;
}

.catalog-sub {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin: 0;
}

/* ── Letter nav ───────────────────────────────────────────────────────────── */
.letter-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 3rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.letter-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.letter-btn.active {
  color: var(--text-secondary);
  border-color: var(--border);
}

.letter-btn.active:hover {
  background: var(--surface-2);
  color: var(--accent);
  border-color: var(--accent);
}

.letter-btn.inactive {
  color: var(--text-muted);
  opacity: 0.35;
  cursor: default;
}

/* ── Catalog body ─────────────────────────────────────────────────────────── */
.catalog-body {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.letter-section {
  scroll-margin-top: 80px;
}

.letter-heading {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2rem;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--accent);
  margin: 0 0 0.75rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border);
}

.track-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.track-item {
  border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
}

.track-item:last-child {
  border-bottom: none;
}

.track-link {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0.25rem;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  transition: color 0.12s;
}

.track-link:hover {
  color: var(--accent-light);
}

.track-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  font-weight: 400;
  flex-shrink: 0;
}

.state {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}
</style>
