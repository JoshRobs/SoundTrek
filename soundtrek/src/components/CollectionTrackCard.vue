<script setup lang="ts">
import type { Soundtrack } from "@/types/soundtrack";
import AppIcon from "@/components/AppIcon.vue";

// When `track` is set the card represents a single track from the soundtrack
// (title = the track name, art = the OST cover, with a TRACK badge); otherwise
// it represents the whole soundtrack (album item).
defineProps<{
  soundtrack: Soundtrack;
  track?: { title: string } | null;
  editMode?: boolean;
}>();
defineEmits<{ click: []; play: []; remove: [] }>();
</script>

<template>
  <button class="cover-card" @click="!editMode && $emit('click')">
    <div class="cover-wrap">
      <img
        v-if="soundtrack.cover_image_url"
        :src="soundtrack.cover_image_url"
        :alt="soundtrack.game_title"
        class="cover-img"
      />
      <div v-else class="cover-fallback">🎮</div>

      <span v-if="track" class="track-badge">Track</span>

      <div class="cover-overlay" :class="{ 'cover-overlay--edit': editMode }">
        <button
          v-if="!editMode"
          class="overlay-play"
          @click.stop="$emit('play')"
        >
          <AppIcon name="play-icon" :size="22" />
        </button>
        <span class="cover-title">{{ track ? track.title : soundtrack.game_title }}</span>
      </div>

      <div v-if="editMode" class="remove-wrap">
        <button
          class="overlay-remove"
          aria-label="Remove from collection"
          @click.stop="$emit('remove')"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
          </svg>
        </button>
      </div>
    </div>
    <div class="card-info">
      <p class="card-title">{{ track ? track.title : soundtrack.game_title }}</p>
      <p class="card-meta">
        <template v-if="track">
          <span>{{ soundtrack.game_title }}</span>
          <span>{{ soundtrack.release_year }}</span>
        </template>
        <template v-else>
          <span v-if="soundtrack.composers?.length">{{ soundtrack.composers.join(", ") }}</span>
          <span>{{ soundtrack.release_year }}</span>
        </template>
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
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  transition: transform 0.18s, box-shadow 0.18s;
}

/* Hover-only lift/reveal. Gated to real hover-capable pointers — on touch,
   browsers simulate :hover under the finger during scroll, which turned this
   into a hover effect sweeping down the list as you scrolled. */
@media (hover: hover) and (pointer: fine) {
  .cover-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
  }

  .cover-card:hover .cover-overlay {
    opacity: 1;
  }
}

.cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
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

.track-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 2;
  padding: 0.12rem 0.45rem;
  border-radius: 5px;
  background: color-mix(in srgb, var(--accent) 85%, black);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s;
}

@media (hover: hover) and (pointer: fine) {
  .cover-card:hover .cover-overlay {
    pointer-events: auto;
  }
}

.cover-overlay--edit {
  background: rgba(127, 29, 29, 0.45);
  justify-content: flex-end;
}

.remove-wrap {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
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

@media (hover: hover) and (pointer: fine) {
  .overlay-play:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }
}

@media (hover: none) {
  .overlay-play:active {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(0.9);
  }
}

/* No hover on touch, and no lift/shadow either — the card stays flat. The
   play button is shown statically (centered on the art) instead of being
   revealed by an interaction; the scrim/title stay off (card-title below
   already shows the title) so the art isn't permanently dimmed, and the
   button is sized up for an easier tap target. Compound selectors so these
   reliably win over the base rules above regardless of source order (equal
   specificity would otherwise fall to whichever is later in the file). */
@media (hover: none) {
  .cover-card .cover-overlay {
    opacity: 1;
    pointer-events: auto;
    background: transparent;
  }

  .cover-card .cover-title {
    display: none;
  }

  .cover-card .overlay-play {
    width: 56px;
    height: 56px;
  }
}

.overlay-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid rgba(107, 114, 128, 0.7);
  background: rgba(0, 0, 0, 0.35);
  color: rgba(156, 163, 175, 0.9);
  cursor: pointer;
  pointer-events: auto;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
}

@media (hover: hover) and (pointer: fine) {
  .cover-card:hover .overlay-remove {
    border-color: rgba(248, 113, 113, 0.9);
    background: rgba(0, 0, 0, 0.4);
    color: #f87171;
  }

  .cover-card .overlay-remove:hover {
    background: rgba(248, 113, 113, 0.3);
    transform: scale(1.1);
  }
}

@media (hover: none) {
  .overlay-remove:active {
    background: rgba(248, 113, 113, 0.3);
    transform: scale(0.9);
  }
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.card-title {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.03em;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s;
}

@media (hover: hover) and (pointer: fine) {
  .card-title:hover {
    color: var(--accent-light, var(--accent));
  }
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

@media (max-width: 768px) {
  .card-title {
    font-size: 1.05rem;
  }
}
</style>
