<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { toSlug } from '@/utils/slug'

const props = defineProps<{
  rank: number
  name: string
  trackCount: number
  totalLikes: number
}>()

const router = useRouter()

const initials = computed(() =>
  props.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase(),
)
</script>

<template>
  <li
    class="composer-row"
    @click="router.push(`/composer/${toSlug(name)}`)"
  >
    <span class="rank" :class="{ gold: rank === 1, silver: rank === 2, bronze: rank === 3 }">
      {{ rank }}
    </span>

    <div class="avatar">{{ initials }}</div>

    <div class="info">
      <span class="name">{{ name }}</span>
      <span class="sub">{{ trackCount }} {{ trackCount === 1 ? 'soundtrack' : 'soundtracks' }}</span>
    </div>

    <div class="likes">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
      {{ totalLikes.toLocaleString() }}
    </div>

    <svg class="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  </li>
</template>

<style scoped>
.composer-row {
  display: grid;
  grid-template-columns: 2.5rem 44px 1fr auto auto;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s;
}

.composer-row:hover { background: var(--surface); }

.rank {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.rank.gold   { color: #f59e0b; }
.rank.silver { color: #94a3b8; }
.rank.bronze { color: #cd7f32; }

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub {
  font-size: 0.73rem;
  color: var(--text-muted);
}

.likes {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.likes svg { color: #f87171; flex-shrink: 0; }

.arrow {
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.composer-row:hover .arrow { opacity: 1; }
</style>
