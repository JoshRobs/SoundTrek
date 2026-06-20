<script setup lang="ts">
const sort  = defineModel<string>('sort',  { required: true })
const indie = defineModel<boolean>('indie', { required: true })

const sortOptions = [
  { value: 'popular', label: 'Popularity' },
  { value: 'newest',  label: 'Newest' },
  { value: 'oldest',  label: 'Oldest' },
  { value: 'az',      label: 'A–Z' },
]
</script>

<template>
  <div class="sort-bar">
    <div class="sort-options">
      <button
        v-for="opt in sortOptions"
        :key="opt.value"
        class="chip"
        :class="{ active: sort === opt.value }"
        @click="sort = opt.value"
      >{{ opt.label }}</button>
    </div>
    <button
      class="chip indie"
      :class="{ active: indie }"
      @click="indie = !indie"
    >
      Indie
    </button>
  </div>
</template>

<style scoped>
.sort-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0 1.5rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.sort-options {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.chip {
  padding: 0.3rem 0.85rem;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.chip.active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.chip.indie.active {
  border-color: var(--accent-3);
  color: var(--accent-3);
  background: color-mix(in srgb, var(--accent-3) 12%, transparent);
}
</style>
