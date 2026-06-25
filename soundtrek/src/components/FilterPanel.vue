<script setup lang="ts">
import { computed } from 'vue'
import type { FilterState } from '@/types/soundtrack'

const props = defineProps<{
  modelValue: FilterState
  availableMoods: string[]
  availableGenres: string[]
  availableThemes: string[]
  availableConsoles: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FilterState]
  'reset': []
}>()

const hasActiveFilters = computed(
  () => props.modelValue.moods.length > 0 || props.modelValue.genres.length > 0 || props.modelValue.themes.length > 0 || props.modelValue.consoles.length > 0
)

type FilterKey = keyof typeof props.modelValue

function toggle(key: FilterKey, val: string) {
  const arr = props.modelValue[key]
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val],
  })
}
</script>

<template>
  <div class="filter-panel">
    <div v-if="availableMoods.length" class="filter-group">
      <p class="filter-label">Mood</p>
      <div class="tag-row">
        <button
          v-for="mood in availableMoods"
          :key="mood"
          class="filter-tag"
          :class="{ active: modelValue.moods.includes(mood) }"
          @click="toggle('moods', mood)"
        >{{ mood }}</button>
      </div>
    </div>

    <div v-if="availableGenres.length" class="filter-group">
      <p class="filter-label">Genre</p>
      <div class="tag-row">
        <button
          v-for="genre in availableGenres"
          :key="genre"
          class="filter-tag genre"
          :class="{ active: modelValue.genres.includes(genre) }"
          @click="toggle('genres', genre)"
        >{{ genre }}</button>
      </div>
    </div>

    <div v-if="availableThemes.length" class="filter-group">
      <p class="filter-label">Theme</p>
      <div class="tag-row">
        <button
          v-for="theme in availableThemes"
          :key="theme"
          class="filter-tag theme"
          :class="{ active: modelValue.themes.includes(theme) }"
          @click="toggle('themes', theme)"
        >{{ theme }}</button>
      </div>
    </div>

    <div v-if="availableConsoles.length" class="filter-group">
      <p class="filter-label">Console</p>
      <div class="tag-row">
        <button
          v-for="c in availableConsoles"
          :key="c"
          class="filter-tag console"
          :class="{ active: modelValue.consoles.includes(c) }"
          @click="toggle('consoles', c)"
        >{{ c }}</button>
      </div>
    </div>

    <button v-if="hasActiveFilters" class="reset-btn" @click="emit('reset')">
      Clear filters
    </button>
  </div>
</template>

<style scoped>
.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-label {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.filter-tag {
  padding: 0.3rem 0.75rem;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.filter-tag:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.filter-tag.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.filter-tag.genre.active {
  background: var(--accent-2);
  border-color: var(--accent-2);
}

.filter-tag.theme.active {
  background: var(--accent-3);
  border-color: var(--accent-3);
}

.filter-tag.console.active {
  background: var(--accent-4, #0e7490);
  border-color: var(--accent-4, #0e7490);
}

.reset-btn {
  align-self: flex-start;
  padding: 0.3rem 0.75rem;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.78rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.reset-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

@media (max-width: 768px) {
  .filter-panel {
    padding: 0.75rem 1rem;
    gap: 0.75rem;
  }
}
</style>
