<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";

const emit = defineEmits<{ navigate: [path: string] }>();
const { topGenres, topThemes } = storeToRefs(useSoundtrackStore());
</script>

<template>
  <div class="col">
    <p class="col-heading">Genres</p>
    <div class="tag-grid">
      <span v-if="topGenres.length === 0" class="empty-note"
        >No genres yet</span
      >
      <button
        v-for="g in topGenres"
        :key="g"
        class="tag-chip"
        @click="emit('navigate', `/discover?genre=${encodeURIComponent(g)}`)"
      >
        {{ g }}
      </button>
    </div>

    <p class="col-heading" style="margin-top: 1.25rem">Themes</p>
    <div class="tag-grid">
      <span v-if="topThemes.length === 0" class="empty-note"
        >No themes yet</span
      >
      <button
        v-for="t in topThemes"
        :key="t"
        class="tag-chip tag-chip--theme"
        @click="emit('navigate', `/discover?theme=${encodeURIComponent(t)}`)"
      >
        {{ t }}
      </button>
    </div>

    <button class="browse-all-btn" @click="emit('navigate', '/explore')">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
      Browse by Category
    </button>
  </div>
</template>

<style scoped>
.col {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0 1.5rem;
}

.col-heading {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-light);
}

.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag-chip {
  padding: 0.25rem 0.65rem;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition:
    background 0.12s,
    border-color 0.12s,
    color 0.12s;
}

.tag-chip:hover {
  border-color: var(--accent);
  color: var(--accent-light);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.tag-chip--theme:hover {
  border-color: var(--accent-3);
  color: var(--accent-3);
  background: color-mix(in srgb, var(--accent-3) 10%, transparent);
}

.empty-note {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: 0.25rem 0.5rem;
}

.browse-all-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1.1rem;
  padding: 0.45rem 0.9rem;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
  align-self: flex-start;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}

.browse-all-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
</style>
