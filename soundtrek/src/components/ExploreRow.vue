<script setup lang="ts">
import { useRouter } from 'vue-router'
import { toSlug } from '@/utils/slug'
import ExploreCard from './ExploreCard.vue'
import type { Soundtrack } from '@/types/soundtrack'

const props = defineProps<{
  type: string
  label: string
  items: Soundtrack[]
}>()

const router = useRouter()

const typeLabels: Record<string, string> = {
  genre: 'Genre',
  mood: 'Mood',
  theme: 'Theme',
  console: 'Console',
}

function seeAll() {
  router.push(`/category/${props.type}/${toSlug(props.label)}`)
}
</script>

<template>
  <section class="row">
    <div class="row-header">
      <div class="row-label-group">
        <h2 class="row-label">{{ label }}</h2>
        <span class="type-badge">{{ typeLabels[type] ?? type }}</span>
      </div>
      <button class="see-all" @click="seeAll">
        See All
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
    <div class="scroll-track">
      <ExploreCard v-for="s in items" :key="s.id" :soundtrack="s" />
    </div>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.row-label-group {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.row-label {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.type-badge {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.see-all {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
  padding: 0;
  transition: color 0.15s;
}

.see-all:hover { color: var(--accent-light); }

.scroll-track {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.scroll-track::-webkit-scrollbar { height: 4px; }
.scroll-track::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
</style>
