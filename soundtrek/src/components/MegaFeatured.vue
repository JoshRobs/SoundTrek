<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";

const emit = defineEmits<{ navigate: [path: string] }>();
const { featuredSoundtracks } = storeToRefs(useSoundtrackStore());
</script>

<template>
  <div class="col">
    <p class="col-heading">Popular Soundtracks</p>
    <div v-if="featuredSoundtracks.length === 0" class="empty-note">
      Loading…
    </div>
    <button
      v-for="s in featuredSoundtracks"
      :key="s.id"
      class="feat-item"
      @click="emit('navigate', `/soundtrack/${s.id}`)"
    >
      <div class="feat-thumb">
        <img
          v-if="s.cover_image_url"
          :src="s.cover_image_url"
          :alt="s.game_title"
        />
        <span v-else class="thumb-emoji">🎮</span>
      </div>
      <div class="feat-info">
        <span class="feat-title">{{ s.game_title }}</span>
        <span class="feat-sub">{{ s.composers.join(', ') || s.studio }} · {{ s.release_year }}</span>
      </div>
    </button>
    <button class="see-more-btn" @click="emit('navigate', '/top')">
      See more
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.col {
  display: flex;
  flex-direction: column;
  gap: 0rem;
  padding: 0 1.5rem 0 0;
}

.col-heading {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-light);
}

.feat-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0.5rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.12s;
}

.feat-item:hover {
  background: var(--surface-2);
}

.feat-thumb {
  width: 40px;
  height: 40px;
  border-radius: 5px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
}

.feat-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-emoji {
  font-size: 1rem;
}

.feat-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.feat-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feat-sub {
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.empty-note {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: 0.25rem 0.5rem;
}
</style>
