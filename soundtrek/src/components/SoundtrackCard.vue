<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import type { Soundtrack } from "@/types/soundtrack";
import CardInfoSheet from "./CardInfoSheet.vue";
import { toSlug } from "@/utils/slug";

defineProps<{ soundtrack: Soundtrack }>();
defineEmits<{ next: [] }>();

const showSheet = ref(false);
const fullscreen = defineModel<boolean>("fullscreen", { default: false });
</script>

<template>
  <div class="card" :class="{ 'card--fs': fullscreen }">
    <div class="cover-wrap">
      <img
        v-if="soundtrack.cover_image_url"
        :src="soundtrack.cover_image_url"
        :alt="soundtrack.game_title"
        class="cover-img"
      />
      <div v-else class="cover-fallback">🎮</div>

      <button
        class="expand-btn"
        :aria-label="fullscreen ? 'Exit fullscreen' : 'Fullscreen'"
        @click="fullscreen = !fullscreen"
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

    <div class="bottom-bar">
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
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  background: var(--card);
}

.card--fs {
  width: 100%;
  height: 100%;
  border-radius: 0;
  box-shadow: none;
  animation: fs-enter 0.2s ease;
}

@keyframes fs-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.card--fs .cover-wrap {
  flex: 1;
  min-height: 0;
  aspect-ratio: unset;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card--fs .cover-img {
  width: auto;
  height: 100%;
  object-fit: unset;
}

.cover-wrap {
  position: relative;
  aspect-ratio: 1/1;
  overflow: hidden;
  background: var(--surface-2);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
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
  background: var(--card);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.title-group {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
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

