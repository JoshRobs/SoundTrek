<script setup lang="ts">
import { computed } from "vue";
import type { QueueItem } from "@/stores/player";

const props = defineProps<{
  items: QueueItem[];
  currentVideoId: string | null;
}>();

const emit = defineEmits<{
  (e: "select", index: number): void;
}>();

// Label each row with its game only when the queue spans multiple OSTs
const mixed = computed(() =>
  props.items.some(
    (i) => i.soundtrack.id !== props.items[0]?.soundtrack.id,
  ),
);
</script>

<template>
  <!-- Key includes the index — playlists can contain the same video twice -->
  <button
    v-for="(item, i) in items"
    :key="`${item.videoId}-${i}`"
    class="playlist-track"
    :class="{
      active: item.videoId === currentVideoId,
      unavailable: item.unavailable,
    }"
    :disabled="item.unavailable"
    @click="!item.unavailable && emit('select', i)"
  >
    <span class="track-num">{{ i + 1 }}</span>
    <span class="track-text">
      <span class="track-title">{{ item.title }}</span>
      <span v-if="mixed" class="track-game">{{
        item.soundtrack.game_title
      }}</span>
    </span>
  </button>
</template>

<style scoped>
/* Sizing is overridable via --queue-* vars for the mobile sheet */
.playlist-track {
  display: flex;
  align-items: center;
  gap: var(--queue-gap, 0.5rem);
  padding: var(--queue-pad, 0.42rem 0.75rem);
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s;
}

.playlist-track:hover {
  background: rgba(255, 255, 255, 0.04);
}

.playlist-track:active {
  background: rgba(255, 255, 255, 0.05);
}

.playlist-track.active {
  background: rgba(255, 255, 255, 0.07);
}

.playlist-track.unavailable {
  cursor: default;
  opacity: 0.3;
}

.playlist-track.unavailable .track-title {
  text-decoration: line-through;
}

.track-num {
  flex-shrink: 0;
  width: 1.4rem;
  text-align: right;
  font-size: var(--queue-num-size, 0.6rem);
  color: rgba(255, 255, 255, 0.2);
  font-variant-numeric: tabular-nums;
}

.playlist-track.active .track-num {
  color: rgba(255, 255, 255, 0.45);
}

.track-text {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.track-title {
  font-size: var(--queue-title-size, 0.7rem);
  color: rgba(255, 255, 255, 0.38);
  line-height: 1.3;
  word-break: break-word;
}

.track-game {
  font-size: calc(var(--queue-title-size, 0.7rem) - 0.06rem);
  color: rgba(255, 255, 255, 0.22);
  line-height: 1.25;
  word-break: break-word;
}

.playlist-track.active .track-game {
  color: rgba(255, 255, 255, 0.45);
}

.playlist-track.active .track-title {
  color: rgba(255, 255, 255, 0.88);
  font-weight: 500;
}
</style>
