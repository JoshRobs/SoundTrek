<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, type LocationQuery } from 'vue-router'
import { storeToRefs } from 'pinia'
import FilterPanel from '@/components/FilterPanel.vue'
import SoundtrackCard from '@/components/SoundtrackCard.vue'
import { useSoundtrackStore } from '@/stores/soundtracks'

const route = useRoute()
const store = useSoundtrackStore()
const {
  allSoundtracks,
  currentSoundtrack,
  loading,
  error,
  filters,
  availableMoods,
  availableGenres,
  availableThemes,
  availableConsoles,
} = storeToRefs(store)
const { fetchSoundtracks, nextSoundtrack, resetFilters } = store

const showFilters = ref(false)
const cardFullscreen = ref(false)
const filterCount = computed(() =>
  filters.value.moods.length + filters.value.genres.length + filters.value.themes.length + filters.value.consoles.length
)

function applyQueryParams(query: LocationQuery) {
  const { id, genre, theme } = query as Record<string, string | undefined>
  if (id) {
    const found = allSoundtracks.value.find(s => s.id === id)
    if (found) currentSoundtrack.value = found
  }
  if (genre) filters.value.genres = [genre]
  if (theme) filters.value.themes  = [theme]
}

onMounted(async () => {
  await fetchSoundtracks()
  applyQueryParams(route.query)
})

watch(() => route.query, (query) => {
  applyQueryParams(query)
})
</script>

<template>
  <!-- Inject filter button into the global header -->
  <Teleport defer to="#header-right">
    <button
      class="filter-toggle"
      :class="{ active: showFilters }"
      aria-label="Toggle filters"
      @click="showFilters = !showFilters"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="4" y1="6" x2="20" y2="6"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
        <line x1="11" y1="18" x2="13" y2="18"/>
      </svg>
      Filters
      <span v-if="filterCount > 0" class="filter-badge">{{ filterCount }}</span>
    </button>
  </Teleport>

  <div class="layout" :class="{ 'layout--fs': cardFullscreen }">

    <Transition name="slide">
      <FilterPanel
        v-if="showFilters"
        v-model="filters"
        :available-moods="availableMoods"
        :available-genres="availableGenres"
        :available-themes="availableThemes"
        :available-consoles="availableConsoles"
        class="filter-panel-bar"
        @reset="resetFilters"
      />
    </Transition>

    <main class="main">
      <div v-if="loading" class="state">
        <div class="spinner" />
        <p>Loading soundtracks…</p>
      </div>

      <div v-else-if="error" class="state error">
        <p>{{ error }}</p>
        <button class="state-btn" @click="fetchSoundtracks()">Retry</button>
      </div>

      <div v-else-if="!currentSoundtrack" class="state">
        <p>No soundtracks match your filters.</p>
        <button class="state-btn" @click="resetFilters">Clear filters</button>
      </div>

      <Transition name="card" mode="out-in">
        <SoundtrackCard
          v-if="currentSoundtrack"
          :key="currentSoundtrack.id"
          :soundtrack="currentSoundtrack"
          v-model:fullscreen="cardFullscreen"
          class="card-slot"
          @next="nextSoundtrack"
        />
      </Transition>
    </main>

  </div>
</template>

<style scoped>
/* Filter button — teleported into the global header */
.filter-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.82rem;
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s, color 0.15s;
}

.filter-toggle:hover,
.filter-toggle.active {
  border-color: var(--accent);
  color: var(--accent);
}

.filter-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Layout */
.layout {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.layout--fs {
  overflow: hidden;
}

.layout--fs .main {
  flex: 1;
  min-height: 0;
  padding: 0;
  align-items: stretch;
  justify-content: flex-start;
}

.layout--fs .card-slot {
  width: 100%;
  height: 100%;
}

.filter-panel-bar {
  flex-shrink: 0;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
}

.card-slot { display: block; }

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 1rem;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 2rem;
}

.state.error { color: #f87171; }
.state p { margin: 0; }

.state-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
}

.state-btn:hover { background: var(--surface-2); }

.spinner { --spinner-size: 30px; width: var(--spinner-size); height: var(--spinner-size); }

.card-enter-active, .card-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.card-enter-from { opacity: 0; transform: translateX(20px); }
.card-leave-to   { opacity: 0; transform: translateX(-20px); }

.slide-enter-active, .slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-enter-from, .slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
