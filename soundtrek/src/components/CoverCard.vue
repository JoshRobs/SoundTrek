<script setup lang="ts">
import type { Soundtrack } from "@/types/soundtrack";

defineProps<{ soundtrack: Soundtrack; showInfo?: boolean }>();
defineEmits<{ click: []; play: [] }>();
</script>

<template>
  <button class="cover-card" :class="{ 'cover-card--with-info': showInfo }" @click="$emit('click')">
    <img
      v-if="soundtrack.cover_image_url"
      :src="soundtrack.cover_image_url"
      :alt="soundtrack.game_title"
      class="cover-img"
    />
    <div v-else class="cover-fallback">🎮</div>
    <div class="cover-overlay">
      <button class="overlay-play" @click.stop="$emit('play')">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <span class="cover-title">{{ soundtrack.game_title }}</span>
    </div>
    <div v-if="showInfo" class="card-info">
      <p class="card-title">{{ soundtrack.game_title }}</p>
      <p class="card-meta">
        <span v-if="soundtrack.composers?.length">{{ soundtrack.composers.join(", ") }}</span>
        <span>{{ soundtrack.release_year }}</span>
      </p>
    </div>
  </button>
</template>

<style scoped>
.cover-card {
  position: relative;
  border: none;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
  cursor: pointer;
  padding: 0;
  display: block;
  width: 100%;
  transition: transform 0.18s, box-shadow 0.18s;
}

.cover-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
}

.cover-card:hover .cover-overlay {
  opacity: 1;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  opacity: 0;
  transition: opacity 0.18s;
}

.cover-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.2;
  text-align: center;
}

.overlay-play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  cursor: pointer;
  padding-left: 3px;
  transition: background 0.15s, transform 0.15s;
}

.overlay-play:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.cover-card--with-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: left;
  background: transparent;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.card-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  gap: 0.4rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta span + span::before {
  content: "·";
  margin-right: 0.4rem;
  opacity: 0.4;
}
</style>
