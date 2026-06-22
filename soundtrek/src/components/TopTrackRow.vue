<script setup lang="ts">
import { useRouter } from "vue-router";
import { useSoundtrackStore } from "@/stores/soundtracks";
import type { Soundtrack } from "@/types/soundtrack";

const props = defineProps<{ rank: number; soundtrack: Soundtrack }>();
const store = useSoundtrackStore();
const router = useRouter();

function goToSoundtrack() {
  router.push(`/soundtrack/${props.soundtrack.id}`);
}
</script>

<template>
  <li class="track-row" @click="goToSoundtrack">
    <span
      class="rank"
      :class="{ gold: rank === 1, silver: rank === 2, bronze: rank === 3 }"
    >
      {{ rank }}
    </span>

    <div class="cover">
      <img
        v-if="soundtrack.cover_image_url"
        :src="soundtrack.cover_image_url"
        :alt="soundtrack.game_title"
      />
      <span v-else class="cover-fallback">🎮</span>
    </div>

    <div class="info">
      <span class="title">{{ soundtrack.game_title }}</span>
      <span class="meta"
        >{{ soundtrack.composer }} · {{ soundtrack.console }} ·
        {{ soundtrack.release_year }}</span
      >
    </div>

    <div class="likes">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
      {{ soundtrack.likes.toLocaleString() }}
    </div>

    <button
      class="play-btn"
      aria-label="Play"
      @click.stop="store.setNowPlaying(props.soundtrack)"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  </li>
</template>

<style scoped>
.track-row {
  display: grid;
  grid-template-columns: 2.5rem 60px 1fr auto auto;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}

.track-row:hover {
  background: var(--surface);
}

.rank {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.rank.gold {
  color: #f59e0b;
}
.rank.silver {
  color: #94a3b8;
}
.rank.bronze {
  color: #cd7f32;
}

.cover {
  width: 64px;
  height: 64px;
  border-radius: 5px;
  overflow: hidden;
  background: var(--surface-2);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-fallback {
  font-size: 1.3rem;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-size: 0.84rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.likes {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 1.4rem;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.likes svg {
  color: #f87171;
  flex-shrink: 0;
}

.play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.15s,
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
  flex-shrink: 0;
}

.track-row:hover .play-btn {
  opacity: 1;
}

.play-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
</style>
