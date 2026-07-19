<script setup lang="ts">
import { ref } from "vue";
import type { TracklistEntry } from "@/types/track";

const props = defineProps<{
  tracks: TracklistEntry[];
  /** Accordion mode for narrow viewports: header toggles the list. */
  collapsible?: boolean;
}>();

const open = ref(!props.collapsible);
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
        :class="{ unavailable: item.unavailable }"
        :title="item.title"
      >
        <span class="tracklist-num">{{ item.position + 1 }}</span>
        <span class="tracklist-title">{{ item.title }}</span>
        <div class="tracklist-actions">
          <button
            type="button"
            class="track-action"
            aria-label="Add to queue"
            title="Add to queue"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="4" y1="7" x2="15" y2="7" />
              <line x1="4" y1="12" x2="15" y2="12" />
              <line x1="4" y1="17" x2="11" y2="17" />
              <line x1="18" y1="14" x2="18" y2="20" />
              <line x1="15" y1="17" x2="21" y2="17" />
            </svg>
          </button>
          <button
            type="button"
            class="track-action"
            aria-label="Add to collection"
            title="Add to collection"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
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
</style>
