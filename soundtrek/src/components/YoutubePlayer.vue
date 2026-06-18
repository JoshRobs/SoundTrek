<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  sourceType: 'playlist' | 'video'
  playlistId: string | null
  videoId: string | null
}>()

const embedUrl = computed(() => {
  if (props.sourceType === 'playlist' && props.playlistId) {
    return `https://www.youtube.com/embed/videoseries?list=${props.playlistId}`
  }
  if (props.sourceType === 'video' && props.videoId) {
    return `https://www.youtube.com/embed/${props.videoId}`
  }
  return null
})
</script>

<template>
  <div v-if="embedUrl" class="player-wrapper">
    <iframe
      :key="embedUrl"
      :src="embedUrl"
      class="player-iframe"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      loading="lazy"
      title="Game Soundtrack"
    />
  </div>
  <div v-else class="player-placeholder">
    <span class="placeholder-icon">♫</span>
    <p>No audio preview available</p>
  </div>
</template>

<style scoped>
.player-wrapper {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 */
  border-radius: 10px;
  overflow: hidden;
  background: #000;
}

.player-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.player-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  background: var(--surface-2);
  border-radius: 10px;
  border: 1px dashed var(--border);
  color: var(--text-muted);
}

.placeholder-icon {
  font-size: 2rem;
  opacity: 0.4;
}

.player-placeholder p {
  margin: 0;
  font-size: 0.85rem;
}
</style>
