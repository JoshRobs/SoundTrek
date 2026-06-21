<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import type { Soundtrack } from "@/types/soundtrack";
import CardInfoSheet from "./CardInfoSheet.vue";
import { toSlug } from "@/utils/slug";
import { useSoundtrackStore } from "@/stores/soundtracks";

const props = defineProps<{ soundtrack: Soundtrack }>();
defineEmits<{ next: [] }>();

const store = useSoundtrackStore();
const showSheet = ref(false);
const fullscreen = defineModel<boolean>("fullscreen", { default: false });
const liked = ref(false);

function toggleLike() {
  const delta = liked.value ? -1 : 1;
  liked.value = !liked.value;
  store.likeSoundtrack(props.soundtrack.id, delta);
}
</script>

<template>
  <div class="card" :class="{ 'card--fs': fullscreen }">
    <div class="cover-frame">
      <div class="cover-wrap" @click="store.setNowPlaying(props.soundtrack)">
        <img
          v-if="soundtrack.cover_image_url"
          :src="soundtrack.cover_image_url"
          :alt="soundtrack.game_title"
          class="cover-img"
        />
        <div v-else class="cover-fallback">🎮</div>

        <div class="play-overlay">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>

        <button
          class="expand-btn"
          :aria-label="fullscreen ? 'Exit fullscreen' : 'Fullscreen'"
          @click.stop="fullscreen = !fullscreen"
        >
          <svg
            v-if="!fullscreen"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="10" y1="14" x2="3" y2="21" />
            <line x1="21" y1="3" x2="14" y2="10" />
          </svg>
        </button>
      </div>
    </div>

    <div class="bottom-bar">
      <div class="title-row">
        <div class="title-group">
          <h1 class="game-title">{{ soundtrack.game_title }}</h1>
          <RouterLink
            :to="`/composer/${toSlug(soundtrack.composer)}`"
            class="composer"
            @click.stop
          >
            {{ soundtrack.composer }}
          </RouterLink>
        </div>
        <button
          class="like-btn"
          :class="{ liked }"
          :aria-label="liked ? 'Unlike' : 'Like'"
          @click="toggleLike"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="icon icon-tabler icons-tabler-outline icon-tabler-heart"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path
              d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"
            />
          </svg>
        </button>
      </div>
      <div class="btn-row">
        <button class="info-btn" @click="showSheet = true">
          More info
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button class="next-btn" @click="$emit('next')">
          Next
          <svg
            width="15"
            height="15"
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
    </div>

    <CardInfoSheet
      v-model:open="showSheet"
      :soundtrack="soundtrack"
      @next="$emit('next')"
    />
  </div>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 450px;
  background: transparent;
  gap: 1rem;
}

.card--fs {
  width: 100%;
  height: 100%;
  gap: 0;
  animation: fs-enter 0.2s ease;
}

@keyframes fs-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.card--fs .cover-wrap {
  flex: 1;
  min-height: 0;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card--fs .cover-img {
  width: auto;
  height: 100%;
  object-fit: unset;
}

.cover-frame {
  position: relative;
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.39);
  transform: translate(6px, 6px);
  transition: transform 0.35s ease;
}

.cover-frame:hover {
  transform: translate(0, 0);
}

.cover-frame::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  transform: translate(12px, 9px);
  pointer-events: none;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cover-frame::after {
  content: "";
  position: absolute;
  inset: 0;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 6px;
  transform: translate(7px, 5px);
  pointer-events: none;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cover-frame:hover::before,
.cover-frame:hover::after {
  opacity: 1;
}

.cover-wrap {
  position: relative;
  overflow: hidden;
  background: var(--surface-2);
  cursor: pointer;
  border-radius: 6px;
}

.cover-wrap:hover .play-overlay {
  opacity: 1;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  opacity: 0;
  transition: opacity 0.18s;
}

.cover-img {
  width: 100%;
  height: auto;
  display: block;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
  color: var(--text-muted);
}

.expand-btn {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.expand-btn:hover {
  opacity: 1;
}

.bottom-bar {
  flex-shrink: 0;
  padding: 0.9rem 1rem 1rem;
  background: transparent;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-group {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.like-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.7rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #f5686c;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.1s;
}

.like-btn:hover {
  background: rgba(224, 53, 59, 0.1);
}

.like-btn.liked svg {
  fill: #f5686c;
}

.like-btn:active {
  transform: scale(0.88);
}

.game-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.7rem;
  font-weight: 400;
  letter-spacing: 0.04em;
  line-height: 1;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card--fs .game-title {
  font-size: 2.4rem;
}

.composer {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;
  transition: color 0.15s;
}

.composer:hover {
  color: var(--accent);
}

.btn-row {
  display: flex;
  gap: 0.5rem;
}

.info-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.8rem;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.15s,
    color 0.15s;
}

.info-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.next-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 0.8rem;
  border-radius: 7px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.1s;
}

.next-btn:hover {
  background: var(--accent-hover);
}
.next-btn:active {
  transform: scale(0.97);
}
</style>
