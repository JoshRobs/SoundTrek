<script setup lang="ts">
import YoutubePlayer from './YoutubePlayer.vue'
import StreamingLinks from './StreamingLinks.vue'
import type { Soundtrack } from '@/types/soundtrack'

defineProps<{ soundtrack: Soundtrack; open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; next: [] }>()
</script>

<template>
  <Teleport to="body">
    <div class="sheet-overlay" :class="{ active: open }" @click.self="emit('update:open', false)">
      <div class="sheet">
        <div class="sheet-handle" />

        <button class="close-btn" @click="emit('update:open', false)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
          Close
        </button>

        <p class="sheet-meta">{{ soundtrack.console }} · {{ soundtrack.release_year }}</p>

        <div class="tags-row">
          <span v-for="tag in soundtrack.mood_tags"  :key="'m-' + tag" class="tag mood-tag">{{ tag }}</span>
          <span v-for="tag in soundtrack.genre_tags" :key="'g-' + tag" class="tag genre-tag">{{ tag }}</span>
        </div>

        <YoutubePlayer
          :source-type="soundtrack.source_type"
          :playlist-id="soundtrack.youtube_playlist_id"
          :video-id="soundtrack.youtube_video_id"
        />

        <StreamingLinks :links="soundtrack.streaming_links ?? []" />

        <button class="next-btn" @click="emit('next'); emit('update:open', false)">
          Next soundtrack
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0);
  pointer-events: none;
  transition: background 0.25s ease;
}

.sheet-overlay.active {
  background: rgba(0, 0, 0, 0.65);
  pointer-events: all;
}

.sheet {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card);
  border-radius: 16px 16px 0 0;
  padding: 0.75rem 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 85vh;
  overflow-y: auto;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-overlay.active .sheet {
  transform: translateY(0);
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  margin: 0 auto 0.25rem;
  flex-shrink: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.78rem;
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
  transition: color 0.15s;
}

.close-btn:hover { color: var(--text-primary); }

.sheet-meta {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tag {
  padding: 0.22rem 0.6rem;
  border-radius: 99px;
  font-size: 0.7rem;
  font-weight: 500;
}

.mood-tag {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent-light);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}

.genre-tag {
  background: color-mix(in srgb, var(--accent-2) 15%, transparent);
  color: var(--accent-2-light);
  border: 1px solid color-mix(in srgb, var(--accent-2) 30%, transparent);
}

.next-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.8rem;
  border-radius: 9px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  margin-top: 0.25rem;
}

.next-btn:hover  { background: var(--accent-hover); }
.next-btn:active { transform: scale(0.98); }
</style>
