<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { toSlug } from "@/utils/slug";

const emit = defineEmits<{ navigate: [path: string] }>();
const { topComposers } = storeToRefs(useSoundtrackStore());
</script>

<template>
  <div class="col">
    <p class="col-heading">Top Composers</p>
    <div v-if="topComposers.length === 0" class="empty-note">Loading…</div>
    <button
      v-for="c in topComposers"
      :key="c.name"
      class="composer-item"
      @click="emit('navigate', `/composer/${toSlug(c.name)}`)"
    >
      <span class="composer-name">{{ c.name }}</span>
      <span class="composer-count"
        >{{ c.count }} {{ c.count === 1 ? "OST" : "OSTs" }}</span
      >
    </button>

    <button class="rankings-btn" @click="emit('navigate', '/top-composers')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
      See full rankings
    </button>
  </div>
</template>

<style scoped>
.col {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0 0 0 1.5rem;
}

.col-heading {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-light);
}

.composer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  border-radius: 7px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.12s;
}

.composer-item:hover {
  background: var(--surface-2);
}

.composer-name {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-count {
  font-size: 0.68rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.empty-note {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: 0.25rem 0.5rem;
}

.rankings-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.6rem;
  padding: 0.45rem 0.9rem;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
  align-self: flex-start;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.rankings-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
</style>
