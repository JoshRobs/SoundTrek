<script setup lang="ts">
import { ref, computed } from "vue";
import type { TracklistEntry } from "@/types/track";
import type { Soundtrack } from "@/types/soundtrack";
import { usePlayerStore } from "@/stores/player";
import { useQueueStore } from "@/stores/queue";
import { storeToRefs } from "pinia";
import AppIcon from "@/components/AppIcon.vue";

const props = defineProps<{
  tracks: TracklistEntry[];
  /** The soundtrack these tracks belong to — needed to enqueue them. */
  soundtrack: Soundtrack;
  /** Accordion mode for narrow viewports: header toggles the list. */
  collapsible?: boolean;
  /** Show the "add to collection" action (only for signed-in users). */
  canCollect?: boolean;
}>();

// Bubbles a track up so the owning view can open the collection modal in
// track mode (this panel doesn't own the modal).
const emit = defineEmits<{ "add-to-collection": [TracklistEntry] }>();

const open = ref(!props.collapsible);

// ── Playback ─────────────────────────────────────────────────────────────────
const player = usePlayerStore();
const itemQueue = useQueueStore();
const { nowPlaying, currentVideoId, queue } = storeToRefs(player);

function playTrack(item: TracklistEntry) {
  if (item.unavailable) return;
  const idx = queue.value.findIndex((q) => q.videoId === item.video_id);
  if (idx !== -1) {
    player.seekToQueueIndex(idx);
  } else {
    player.playFromTrack(props.soundtrack, item.video_id);
  }
}

// ── Now-playing indicator ────────────────────────────────────────────────────

// Only highlight rows when this tracklist's OST is the one actually playing.
const activeVideoId = computed<string | null>(() =>
  nowPlaying.value?.id === props.soundtrack.id ? currentVideoId.value : null,
);

// ── Add to queue ────────────────────────────────────────────────────────────
const added = ref(new Set<number>());

function addToQueue(item: TracklistEntry) {
  // With an item queue running, it's "the queue" the user sees — append there
  // (as a track item) so the panel stays the single source of truth. Otherwise
  // fall back to the ad-hoc player track queue.
  if (itemQueue.isActive) {
    itemQueue.addTrack(props.soundtrack, {
      videoId: item.video_id,
      title: item.title,
    });
  } else {
    player.enqueueTrack(props.soundtrack, {
      videoId: item.video_id,
      title: item.title,
      unavailable: item.unavailable,
    });
  }
  added.value.add(item.position);
  setTimeout(() => added.value.delete(item.position), 1600);
}
</script>

<template>
  <aside class="tracklist-card">
    <button
      v-if="collapsible"
      type="button"
      class="tracklist-head tracklist-toggle"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="tracklist-heading">Tracklist</span>
      <span class="tracklist-count">{{ tracks.length }} tracks</span>
      <svg
        class="tracklist-chevron"
        :class="{ open }"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <header v-else class="tracklist-head">
      <h2 class="tracklist-heading">Tracklist</h2>
      <span class="tracklist-count">{{ tracks.length }} tracks</span>
    </header>

    <ol v-show="open" class="tracklist">
      <li
        v-for="item in tracks"
        :key="item.position"
        class="tracklist-item"
        :class="{
          unavailable: item.unavailable,
          playing: activeVideoId === item.video_id,
        }"
        :title="item.title"
        @click="playTrack(item)"
      >
        <span class="tracklist-num">
          <span v-if="activeVideoId === item.video_id" class="now-playing-bars" aria-label="Now playing">
            <span /><span /><span />
          </span>
          <template v-else>{{ item.position + 1 }}</template>
        </span>
        <span class="tracklist-title">{{ item.title }}</span>
        <div class="tracklist-actions" @click.stop>
          <button
            type="button"
            class="track-action"
            :class="{ 'track-action--added': added.has(item.position) }"
            :disabled="item.unavailable"
            :aria-label="added.has(item.position) ? 'Added to queue' : 'Add to queue'"
            :title="added.has(item.position) ? 'Added!' : 'Add to queue'"
            @click="addToQueue(item)"
          >
            <AppIcon v-if="added.has(item.position)" name="check-icon" :size="15" />
            <AppIcon v-else name="add-to-queue-icon" :size="15" />
          </button>
          <button
            v-if="canCollect"
            type="button"
            class="track-action"
            aria-label="Add to collection"
            title="Add to collection"
            @click="emit('add-to-collection', item)"
          >
            <AppIcon name="plus-icon" :size="15" />
          </button>
        </div>
      </li>
    </ol>
  </aside>
</template>

<style scoped>
.tracklist-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0; /* let a height-capped parent shrink it; the list scrolls */
  max-height: 630px;
  padding: 0;
  border: 1px solid var(--border);
  background: var(--surface);
  overflow: hidden;
}

.tracklist-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--border);
}

.tracklist-toggle {
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
}

.tracklist-toggle:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.tracklist-toggle .tracklist-count {
  margin-left: auto;
}

.tracklist-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.15s ease;
}

.tracklist-chevron.open {
  transform: rotate(180deg);
}

.tracklist-heading {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #acacac;
}

.tracklist-count {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.tracklist {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.tracklist-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.35rem 0.6rem 0.35rem 0.85rem;
  font-size: 0.9rem;
  line-height: 1.35;
  color: var(--text-secondary);
  border-left: 2px solid transparent;
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
}

.tracklist-item + .tracklist-item {
  border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
}

.tracklist-item:not(.unavailable) {
  cursor: pointer;
}

.tracklist-item:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-left-color: var(--accent);
}

.tracklist-num {
  flex-shrink: 0;
  min-width: 1.6em;
  text-align: right;
  font-size: 0.76rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  transition: color 0.12s ease;
}

.tracklist-item:hover .tracklist-num {
  color: var(--text-secondary);
}

.tracklist-title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.12s ease;
}

.tracklist-item:hover .tracklist-title {
  color: var(--text-primary);
}

.tracklist-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0;
  transform: translateX(4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.tracklist-item:hover .tracklist-actions,
.tracklist-item:focus-within .tracklist-actions {
  opacity: 1;
  transform: none;
}

/* Touch devices have no hover — keep the actions visible, with bigger
   touch targets and a little more row breathing room. */
@media (hover: none) {
  .tracklist-actions {
    opacity: 1;
    transform: none;
  }

  .track-action {
    width: 32px;
    height: 32px;
  }

  .tracklist-item {
    padding-top: 0.45rem;
    padding-bottom: 0.45rem;
  }
}

.track-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    color 0.12s ease,
    background 0.12s ease;
}

.track-action:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}

.track-action:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.track-action--added,
.track-action--added:hover {
  color: #1db954;
  background: transparent;
}

.track-action:disabled {
  cursor: default;
  color: var(--text-muted);
  background: transparent;
}

.tracklist-item.unavailable {
  opacity: 0.45;
}

.tracklist-item.unavailable .tracklist-title {
  text-decoration: line-through;
}

/* Actions keep their space (rows stay equal height) but never show. */
.tracklist-item.unavailable .tracklist-actions {
  visibility: hidden;
  pointer-events: none;
}

/* ── Now-playing indicator ─────────────────────────────────────────────────── */
.tracklist-item.playing {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border-left-color: var(--accent);
}

.tracklist-item.playing .tracklist-title {
  color: var(--accent);
}

.now-playing-bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 11px;
}

.now-playing-bars span {
  display: block;
  width: 3px;
  height: 11px;
  border-radius: 1.5px;
  background: var(--accent);
  transform-origin: bottom;
  animation: bar-pulse ease-in-out infinite;
}

/* Same duration, delays spaced D/3 apart → peak travels left to right */
.now-playing-bars span:nth-child(1) { animation-duration: 1.8s; animation-delay: -0.9s; }
.now-playing-bars span:nth-child(2) { animation-duration: 1.8s; animation-delay: -0.3s; }
.now-playing-bars span:nth-child(3) { animation-duration: 1.8s; animation-delay: -1.5s; }

@keyframes bar-pulse {
  0%, 100% { transform: scaleY(0.4); }
  50%       { transform: scaleY(1); }
}
</style>
