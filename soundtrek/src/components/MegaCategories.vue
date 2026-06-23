<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { toSlug } from "@/utils/slug";

const emit = defineEmits<{ navigate: [path: string] }>();
const { topMoods } = storeToRefs(useSoundtrackStore());
</script>

<template>
  <div class="col">
    <p class="col-heading">Moods</p>
    <div class="tag-grid">
      <span v-if="topMoods.length === 0" class="empty-note">No moods yet</span>
      <button
        v-for="m in topMoods"
        :key="m"
        class="tag-chip"
        @click="emit('navigate', `/category/mood/${toSlug(m)}`)"
      >
        {{ m }}
      </button>
    </div>

    <button class="see-more-btn" @click="emit('navigate', '/explore')">
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
