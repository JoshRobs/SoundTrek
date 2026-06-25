<script setup lang="ts">
import { useRouter } from "vue-router";
import type { Soundtrack } from "@/types/soundtrack";

const props = defineProps<{ soundtrack: Soundtrack }>();
const router = useRouter();
</script>

<template>
  <div class="card" @click="router.push(`/soundtrack/${props.soundtrack.id}`)">
    <div class="cover">
      <img
        v-if="soundtrack.cover_image_url"
        :src="soundtrack.cover_image_url"
        :alt="soundtrack.game_title"
      />
      <span v-else class="fallback">🎮</span>

      <div class="hover-overlay">
        <svg
          class="arrow"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
    </div>
    <p class="title">{{ soundtrack.game_title }}</p>
    <span class="meta"
      >{{ soundtrack.composers.join(', ') || soundtrack.studio }} · {{ soundtrack.console }} ·
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
  aspect-ratio: 3 / 4;
  flex-shrink: 0;
}

.cover {
  position: relative;
  aspect-ratio: 3 / 4;
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

.hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  opacity: 0;
  transition: opacity 0.15s;
  color: #fff;
}

.card:hover .hover-overlay {
  opacity: 1;
}

.arrow {
  opacity: 0.7;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}

.title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.meta {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0;
}

@media (max-width: 768px) {
  .card {
    width: 140px;
  }

  .title {
    font-size: 0.85rem;
  }

  .meta {
    font-size: 0.72rem;
  }

  .hover-overlay {
    display: none;
  }
}
</style>
