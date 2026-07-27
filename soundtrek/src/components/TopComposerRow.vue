<script setup lang="ts">
import { useRouter } from "vue-router";
import { toSlug } from "@/utils/slug";

const props = defineProps<{
  rank: number;
  name: string;
  trackCount: number;
  totalLikes: number;
  imageUrl?: string | null;
}>();

const router = useRouter();
</script>

<template>
  <div class="composer-card" @click="router.push(`/composer/${toSlug(name)}`)">
    <div class="avatar-wrap">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="name"
        class="photo"
        referrerpolicy="no-referrer"
      />
      <div v-else class="photo-fallback">
        <svg viewBox="0 0 24 24" fill="currentColor" class="silhouette">
          <path
            d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"
          />
        </svg>
      </div>
      <span
        class="rank"
        :class="{ gold: rank === 1, silver: rank === 2, bronze: rank === 3 }"
        >{{ rank }}</span
      >
    </div>
    <div class="info">
      <p class="name">{{ name }}</p>
      <div class="meta">
        <span
          >{{ trackCount }}
          {{ trackCount === 1 ? "soundtrack" : "soundtracks" }}</span
        >
        <span class="dot">·</span>
        <span class="likes">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
          </svg>
          {{ totalLikes.toLocaleString() }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.composer-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  text-align: center;
  transition: transform 0.18s;
}

.composer-card:hover {
  transform: translateY(-3px);
}

.avatar-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  overflow: hidden;
  background: var(--surface-2);
  border: 2px solid var(--border);
  transition:
    border-color 0.25s,
    box-shadow 0.25s;
}

.composer-card:hover .avatar-wrap {
  border-color: #77777770;
  box-shadow: 0 0 20px color-mix(in srgb, white 20%, transparent);
}

.composer-card:hover .avatar-wrap:has(.rank.gold) {
  border-color: rgba(245, 158, 11, 0.8);
  box-shadow: 0 0 32px color-mix(in srgb, #f59e0b 40%, transparent);
}

.composer-card:hover .avatar-wrap:has(.rank.silver) {
  border-color: rgba(148, 163, 184, 0.8);
  box-shadow: 0 0 32px color-mix(in srgb, #94a3b8 40%, transparent);
}

.composer-card:hover .avatar-wrap:has(.rank.bronze) {
  border-color: rgba(205, 127, 50, 0.8);
  box-shadow: 0 0 32px color-mix(in srgb, #cd7f32 40%, transparent);
}

.photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}

.composer-card:hover .photo {
  transform: scale(1.06);
}

.photo-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.silhouette {
  width: 60%;
  height: 60%;
  color: var(--border);
}

.rank {
  position: absolute;
  bottom: 4%;
  right: 4%;
  font-size: 0.85rem;
  font-weight: 800;
  background: var(--surface-2);
  color: var(--text-muted);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.rank.gold {
  color: #ffad20;
}
.rank.silver {
  color: #94a3b8;
}
.rank.bronze {
  color: #cd7f32;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  width: 100%;
}

.name {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.dot {
  opacity: 0.4;
}

.likes {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.likes svg {
  color: #f87171;
  flex-shrink: 0;
}
</style>
