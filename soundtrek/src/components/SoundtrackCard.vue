<script setup lang="ts">
import type { Soundtrack } from '@/types/soundtrack'
import YoutubePlayer from './YoutubePlayer.vue'

defineProps<{ soundtrack: Soundtrack }>()
defineEmits<{ next: [] }>()
</script>

<template>
  <article class="card">
    <!-- Header: cover art + meta -->
    <div class="card-header">
      <div class="cover-art">
        <img
          v-if="soundtrack.cover_image_url"
          :src="soundtrack.cover_image_url"
          :alt="`${soundtrack.game_title} cover art`"
          class="cover-img"
        />
        <div v-else class="cover-placeholder">
          <span>🎮</span>
        </div>
      </div>

      <div class="card-meta">
        <h1 class="game-title">{{ soundtrack.game_title }}</h1>
        <p class="composer">{{ soundtrack.composer }}</p>
        <p class="details">
          <span class="console">{{ soundtrack.console }}</span>
          <span class="separator">·</span>
          <span class="year">{{ soundtrack.release_year }}</span>
        </p>
      </div>
    </div>

    <!-- Tags -->
    <div class="tags-row">
      <span
        v-for="tag in soundtrack.mood_tags"
        :key="'mood-' + tag"
        class="tag mood-tag"
      >{{ tag }}</span>
      <span
        v-for="tag in soundtrack.genre_tags"
        :key="'genre-' + tag"
        class="tag genre-tag"
      >{{ tag }}</span>
    </div>

    <!-- YouTube player -->
    <YoutubePlayer
      :source-type="soundtrack.source_type"
      :playlist-id="soundtrack.youtube_playlist_id"
      :video-id="soundtrack.youtube_video_id"
    />

    <!-- Next button -->
    <button class="next-btn" @click="$emit('next')" aria-label="Next soundtrack">
      Next
      <svg class="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </button>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.5rem;
  width: 100%;
  max-width: 560px;
}

/* Header */
.card-header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.cover-art {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.game-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.composer {
  margin: 0;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.details {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.separator {
  opacity: 0.4;
}

/* Tags */
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tag {
  padding: 0.25rem 0.65rem;
  border-radius: 99px;
  font-size: 0.73rem;
  font-weight: 500;
  letter-spacing: 0.02em;
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

/* Next button */
.next-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.875rem 1.5rem;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.next-btn:hover {
  background: var(--accent-hover);
}

.next-btn:active {
  transform: scale(0.98);
}

.arrow {
  flex-shrink: 0;
}
</style>
