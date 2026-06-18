<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SoundtrackCard from './components/SoundtrackCard.vue'
import FilterPanel from './components/FilterPanel.vue'
import { useSoundtracks } from './composables/useSoundtracks'

const {
  currentSoundtrack,
  loading,
  error,
  filters,
  filteredPool,
  availableMoods,
  availableGenres,
  availableConsoles,
  fetchSoundtracks,
  nextSoundtrack,
  resetFilters,
} = useSoundtracks()

const showFilters = ref(false)

onMounted(() => fetchSoundtracks())

function handleNext() {
  nextSoundtrack()
}
</script>

<template>
  <div class="layout">
    <!-- Header -->
    <header class="header">
      <div class="logo">
        <span class="logo-icon">🎮</span>
        <span class="logo-text">SoundTrek</span>
      </div>

      <button
        class="filter-toggle"
        :class="{ active: showFilters }"
        @click="showFilters = !showFilters"
        aria-label="Toggle filters"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="11" y1="18" x2="13" y2="18"/>
        </svg>
        Filters
        <span v-if="filters.moods.length + filters.genres.length + filters.consoles.length > 0" class="filter-badge">
          {{ filters.moods.length + filters.genres.length + filters.consoles.length }}
        </span>
      </button>
    </header>

    <!-- Main content -->
    <main class="main">
      <!-- Filter panel (collapsible) -->
      <Transition name="slide">
        <FilterPanel
          v-if="showFilters"
          v-model="filters"
          :available-moods="availableMoods"
          :available-genres="availableGenres"
          :available-consoles="availableConsoles"
          @reset="resetFilters"
        />
      </Transition>

      <!-- Pool indicator -->
      <p v-if="!loading && filteredPool.length > 0" class="pool-count">
        {{ filteredPool.length }} soundtrack{{ filteredPool.length === 1 ? '' : 's' }} in pool
      </p>

      <!-- Loading -->
      <div v-if="loading" class="state-message">
        <div class="spinner" />
        <p>Loading soundtracks…</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="state-message error">
        <p>{{ error }}</p>
        <button class="retry-btn" @click="fetchSoundtracks()">Retry</button>
      </div>

      <!-- Empty pool -->
      <div v-else-if="!currentSoundtrack && filteredPool.length === 0" class="state-message">
        <p>No soundtracks match your filters.</p>
        <button class="retry-btn" @click="resetFilters">Clear filters</button>
      </div>

      <!-- Soundtrack card -->
      <Transition name="card" mode="out-in">
        <SoundtrackCard
          v-if="currentSoundtrack"
          :key="currentSoundtrack.id"
          :soundtrack="currentSoundtrack"
          @next="handleNext"
        />
      </Transition>
    </main>

    <footer class="footer">
      <p>Built for game OST lovers · <a href="https://soundtrek.app" target="_blank">soundtrek.app</a></p>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: 0 1rem;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo-icon {
  font-size: 1.25rem;
}

.logo-text {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.filter-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  position: relative;
}

.filter-toggle:hover,
.filter-toggle.active {
  border-color: var(--accent);
  color: var(--accent);
}

.filter-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Main */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 560px;
  width: 100%;
  margin: 0 auto;
  padding-bottom: 2rem;
}

.pool-count {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  align-self: flex-end;
}

/* State messages */
.state-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  text-align: center;
}

.state-message.error {
  color: #f87171;
}

.state-message p {
  margin: 0;
}

.retry-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
}

.retry-btn:hover {
  background: var(--surface-2);
}

/* Spinner */
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Footer */
.footer {
  text-align: center;
  padding: 1.5rem 0;
  border-top: 1px solid var(--border);
  margin-top: auto;
}

.footer p {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.footer a {
  color: var(--accent);
  text-decoration: none;
}

.footer a:hover {
  text-decoration: underline;
}

/* Transitions */
.card-enter-active,
.card-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.card-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.card-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
