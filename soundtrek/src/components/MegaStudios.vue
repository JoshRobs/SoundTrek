<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { toSlug } from "@/utils/slug";

const emit = defineEmits<{ navigate: [path: string] }>();
const { topStudios } = storeToRefs(useSoundtrackStore());
</script>

<template>
  <div class="col">
    <p class="col-heading">Top Studios</p>
    <div v-if="topStudios.length === 0" class="empty-note">Loading…</div>
    <button
      v-for="s in topStudios"
      :key="s.name"
      class="studio-item"
      @click="emit('navigate', `/studio/${toSlug(s.name)}`)"
    >
      <span class="studio-name">{{ s.name }}</span>
      <span class="studio-count">{{ s.count }} {{ s.count === 1 ? "OST" : "OSTs" }}</span>
    </button>
    <button class="see-more-btn" @click="emit('navigate', '/studios')">
      See more
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
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

.studio-item {
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

.studio-item:hover {
  background: var(--surface-2);
}

.studio-name {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.studio-count {
  font-size: 0.68rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.empty-note {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: 0.25rem 0.5rem;
}

.see-more-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.5rem;
  padding: 0.3rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--accent-light);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 5px;
  transition: background 0.12s;
}

.see-more-btn:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
</style>
