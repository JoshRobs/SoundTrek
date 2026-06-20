<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSoundtrackStore } from '@/stores/soundtracks'
import type { Soundtrack } from '@/types/soundtrack'

const props = defineProps<{ soundtrack: Soundtrack }>()
const router = useRouter()
const store = useSoundtrackStore()
</script>

<template>
  <div class="card" @click="router.push(`/discover?id=${props.soundtrack.id}`)">
    <div class="card-body">
      <div class="cover">
        <img v-if="soundtrack.cover_image_url" :src="soundtrack.cover_image_url" :alt="soundtrack.game_title" />
        <span v-else class="cover-fallback">🎮</span>
      </div>

      <div class="info-panel">
        <p class="composer">{{ soundtrack.composer }}</p>
        <p class="meta">{{ soundtrack.release_year }} · {{ soundtrack.console }}</p>
        <div v-if="soundtrack.likes > 0" class="likes">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {{ soundtrack.likes.toLocaleString() }}
        </div>
        <div class="tags">
          <span
            v-for="tag in [...(soundtrack.genre_tags ?? []), ...(soundtrack.mood_tags ?? [])].slice(0, 3)"
            :key="tag"
            class="tag"
          >{{ tag }}</span>
        </div>
      </div>

      <button
        class="play-btn"
        aria-label="Play"
        @click.stop="store.setNowPlaying(props.soundtrack)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
    </div>

    <p class="game-title">{{ soundtrack.game_title }}</p>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.85rem;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: border-color 0.15s, background 0.15s;
}

.card:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  background: var(--surface-2);
}

.card-body {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: 0.85rem;
  align-items: start;
}

.cover {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-fallback { font-size: 1.8rem; }

.info-panel {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding-top: 0.1rem;
}

.composer {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin: 0;
}

.likes {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.likes svg { color: #f87171; flex-shrink: 0; }

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.15rem;
}

.tag {
  padding: 0.15rem 0.45rem;
  border-radius: 99px;
  background: var(--card);
  border: 1px solid var(--border);
  font-size: 0.65rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, border-color 0.15s, color 0.15s;
}

.card:hover .play-btn {
  opacity: 1;
}

.play-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.game-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
