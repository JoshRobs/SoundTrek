<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { supabase } from '@/lib/supabase'
import { useSoundtrackStore } from '@/stores/soundtracks'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import PageHero from '@/components/PageHero.vue'
import TopTrackRow from '@/components/TopTrackRow.vue'
import type { Soundtrack } from '@/types/soundtrack'

const PAGE_SIZE = 20
const items = ref<Soundtrack[]>([])
const error = ref<string | null>(null)
const sentinelEl = useTemplateRef<HTMLElement>('sentinel')

const { loadAll } = useSoundtrackStore()

const { loading, exhausted } = useInfiniteScroll(sentinelEl, async () => {
  const from = items.value.length
  const { data, error: err } = await supabase
    .from('soundtracks')
    .select('*')
    .order('likes', { ascending: false })
    .order('created_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)

  if (err) { error.value = err.message; return false }
  items.value.push(...(data ?? []))
  return (data?.length ?? 0) >= PAGE_SIZE
})

loadAll()
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero label="Charts" title="Top Soundtracks" subtitle="Ranked by community likes" />

      <div v-if="error" class="error">{{ error }}</div>

      <ol class="track-list">
        <TopTrackRow
          v-for="(s, i) in items"
          :key="s.id"
          :rank="i + 1"
          :soundtrack="s"
        />
      </ol>

      <div ref="sentinel" class="sentinel">
        <div v-if="loading" class="loading">
          <div class="spinner" />
          <span>Loading more…</span>
        </div>
        <p v-else-if="exhausted && items.length > 0" class="end-note">
          You've seen all {{ items.length }} soundtracks
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  overflow-y: auto;
}

.page-inner {
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 4rem;
}

.track-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* Row separators — targeting child component roots */
.track-list > li + li {
  border-top: 1px solid var(--border);
}

.track-list > li:hover + li {
  border-top-color: transparent;
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

.end-note { margin: 0; font-size: 0.8rem; color: var(--text-muted); }
.error { padding: 2rem; color: #f87171; font-size: 0.9rem; }

.spinner {
  --spinner-size: 20px;
  width: var(--spinner-size);
  height: var(--spinner-size);
}
</style>
