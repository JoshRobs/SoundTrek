<script setup lang="ts">
import { useRouter } from "vue-router";
import { useSoundtrackStore } from "@/stores/soundtracks";
import type { Soundtrack } from "@/types/soundtrack";

const props = defineProps<{ soundtrack: Soundtrack }>();
const router = useRouter();
const store = useSoundtrackStore();
</script>

<template>
  <div class="card" @click="router.push(`/discover?id=${props.soundtrack.id}`)">
    <div class="cover">
      <img
        v-if="soundtrack.cover_image_url"
        :src="soundtrack.cover_image_url"
        :alt="soundtrack.game_title"
      />
      <span v-else class="fallback">🎮</span>

      <button
        class="play-btn"
        aria-label="Play"
        @click.stop="store.setNowPlaying(props.soundtrack)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>
    <p class="title">{{ soundtrack.game_title }}</p>
    <span class="meta"
      >{{ soundtrack.composer }} · {{ soundtrack.console }} ·
      {{ soundtrack.release_year }}</span
    >
  </div>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
  width: 220px;
  flex-shrink: 0;
}

.cover {
  position: relative;
  width: 220px;
  height: 220px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.15s,
    box-shadow 0.15s;
}

.card:hover .cover {
  transform: scale(1.03);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fallback {
  font-size: 2.5rem;
}

.play-btn {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  border: none;
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.card:hover .play-btn {
  opacity: 1;
}

.play-btn svg {
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
}

.title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.meta {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin: 0;
}
</style>
