<script setup lang="ts">
import type { StreamingLink, StreamingPlatform } from '@/types/soundtrack'

defineProps<{ links: StreamingLink[] }>()

const platformMeta: Record<StreamingPlatform, { label: string; color: string }> = {
  youtube:      { label: 'YouTube',      color: '#ff0000' },
  spotify:      { label: 'Spotify',      color: '#1db954' },
  apple_music:  { label: 'Apple Music',  color: '#fc3c44' },
  bandcamp:     { label: 'Bandcamp',     color: '#1da0c3' },
  soundcloud:   { label: 'SoundCloud',   color: '#ff5500' },
  amazon_music: { label: 'Amazon Music', color: '#00a8e1' },
  other:        { label: 'Listen',       color: '#94a3b8' },
}
</script>

<template>
  <div v-if="links.length" class="streaming-links">
    <div class="links-row">
      <a
        v-for="link in links"
        :key="link.platform + link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="link-btn"
        :style="{ '--platform-color': platformMeta[link.platform]?.color ?? '#94a3b8' }"
      >
        {{ link.label ?? platformMeta[link.platform]?.label ?? 'Listen' }}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
    </div>
  </div>
</template>

<style scoped>
.streaming-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}


.links-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.8rem;
  border-radius: 99px;
  border: 1px solid color-mix(in srgb, var(--platform-color) 35%, transparent);
  background: color-mix(in srgb, var(--platform-color) 10%, transparent);
  color: var(--platform-color);
  font-size: 0.78rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
}

.link-btn:hover {
  background: color-mix(in srgb, var(--platform-color) 20%, transparent);
  border-color: color-mix(in srgb, var(--platform-color) 55%, transparent);
}

@media (max-width: 768px) {
  .link-btn {
    padding: 0.5rem 1rem;
    font-size: 0.82rem;
  }
}
</style>
