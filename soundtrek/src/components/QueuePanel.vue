<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { useQueueStore } from "@/stores/queue";
import { useIsMobile } from "@/composables/useIsMobile";
import type { CollectionItem } from "@/types/collection";

const queue = useQueueStore();
const {
  isActive,
  items,
  currentIndex,
  name,
  fromCollection,
  hasNext,
  hasPrev,
} = storeToRefs(queue);
const { isMobile } = useIsMobile();

// The drawer is fixed-positioned (teleported to body) but should sit below the
// app header, so we measure the header and offset the drawer's top by it.
const headerHeight = ref(64);
function measureHeader() {
  const el = document.querySelector("header.header") as HTMLElement | null;
  if (el) headerHeight.value = el.offsetHeight;
}
onMounted(() => {
  measureHeader();
  window.addEventListener("resize", measureHeader);
});
onUnmounted(() => window.removeEventListener("resize", measureHeader));

// Desktop: the drawer is open while the right edge / panel is hovered, and
// slides away otherwise.
const open = ref(false);
const hovered = ref(false);
const drawerEl = ref<HTMLElement | null>(null);
function onEnter() {
  hovered.value = true;
  open.value = true;
}
function onLeave() {
  // Keep the drawer pinned open while a drag is in progress, so the list can't
  // slide away from under the pointer.
  if (dragIndex.value !== null) return;
  hovered.value = false;
  open.value = false;
}

// ── Drag-to-reorder ───────────────────────────────────────────────────────────
// The list is reordered live as the pointer moves; <TransitionGroup> FLIP-
// animates the rows sliding into place. Hit-testing uses the slot geometry
// captured at drag start (rows are ~uniform height, dominated by the 40px
// thumbnail), so it stays stable regardless of the in-flight move animations.
const dragIndex = ref<number | null>(null); // current position of the dragged item
let dragListTop = 0;
let dragRowHeight = 0;

function onHandleDown(e: PointerEvent, index: number) {
  e.preventDefault();
  const row = (e.currentTarget as HTMLElement).closest(
    "li.cq-item",
  ) as HTMLElement | null;
  const list = row?.parentElement as HTMLElement | null;
  if (!row || !list) return;
  const firstRow = (list.firstElementChild as HTMLElement | null) ?? row;
  dragListTop = firstRow.getBoundingClientRect().top;
  dragRowHeight = row.getBoundingClientRect().height || 1;
  dragIndex.value = index;
  hovered.value = true;
  open.value = true;
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragUp);
}

function onDragMove(e: PointerEvent) {
  if (dragIndex.value === null) return;
  const n = items.value.length;
  let target = Math.floor((e.clientY - dragListTop) / dragRowHeight);
  target = Math.max(0, Math.min(target, n - 1));
  if (target !== dragIndex.value) {
    queue.moveItem(dragIndex.value, target);
    dragIndex.value = target;
  }
}

function onDragUp(e: PointerEvent) {
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", onDragUp);
  dragIndex.value = null;

  // Resolve the drawer's open state from where the pointer ended up (a drag can
  // wander outside the drawer, which we deliberately ignored until now).
  const el = drawerEl.value;
  if (el) {
    const r = el.getBoundingClientRect();
    const inside =
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom;
    hovered.value = inside;
    open.value = inside;
  }
}

// Mobile: the bottom sheet is collapsed to a slim bar until tapped open.
const collapsed = ref(true);

// Title shown in the panel/bar: the collection name when seeded from one,
// otherwise a generic label.
const title = computed(() => (fromCollection.value ? name.value : "Queue"));
const label = computed(() =>
  fromCollection.value ? "Playing collection" : "Playing queue",
);

// Peek the drawer open when a queue first attaches so it's discoverable, then
// let it collapse (unless the pointer is on it).
watch(isActive, (active, prev) => {
  if (active && !prev) {
    open.value = true;
    window.setTimeout(() => {
      if (!hovered.value) open.value = false;
    }, 1800);
  }
});

function itemTitle(item: CollectionItem): string {
  return item.video_id
    ? (item.track_title ?? "")
    : (item.soundtrack?.game_title ?? "");
}
function itemSubtitle(item: CollectionItem): string {
  if (!item.soundtrack) return "";
  return item.video_id
    ? item.soundtrack.game_title
    : (item.soundtrack.composers?.join(", ") ?? "");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isActive">
      <!-- ══ Desktop: right-edge hover drawer ═══════════════════════════════ -->
      <div
        v-if="!isMobile"
        class="queue-clip"
        :style="{ top: headerHeight + 'px' }"
      >
        <aside
          ref="drawerEl"
          class="queue-drawer"
          :class="{ open, dragging: dragIndex !== null }"
          @mouseenter="onEnter"
          @mouseleave="onLeave"
        >
          <!-- Grip: the slim strip that shows when the drawer is tucked away -->
          <div class="queue-grip" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span class="queue-grip-label">{{ title }}</span>
            <span class="queue-grip-count"
              >{{ currentIndex + 1 }}/{{ items.length }}</span
            >
          </div>

          <header class="cq-header">
            <div class="cq-titles">
              <span class="cq-label">{{ label }}</span>
              <span class="cq-name">{{ title }}</span>
            </div>
            <button
              class="cq-icon-btn"
              aria-label="Close queue"
              @click="queue.close()"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div class="cq-nav">
            <button
              class="cq-nav-btn"
              :disabled="!hasPrev"
              aria-label="Previous item"
              @click="queue.prevItem()"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>
            <span class="cq-nav-label"
              >Item {{ currentIndex + 1 }} of {{ items.length }}</span
            >
            <button
              class="cq-nav-btn"
              :disabled="!hasNext"
              aria-label="Next item"
              @click="queue.nextItem()"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" />
              </svg>
            </button>
          </div>

          <TransitionGroup tag="ol" name="cq" class="cq-list">
            <li
              v-for="(item, i) in items"
              :key="item.id"
              class="cq-item"
              :class="{ active: i === currentIndex, dragging: dragIndex === i }"
              @click="queue.playItem(i)"
            >
              <button
                class="cq-handle"
                aria-label="Drag to reorder"
                @pointerdown.stop.prevent="onHandleDown($event, i)"
                @click.stop
              >
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2.5" cy="3" r="1.3" />
                  <circle cx="7.5" cy="3" r="1.3" />
                  <circle cx="2.5" cy="8" r="1.3" />
                  <circle cx="7.5" cy="8" r="1.3" />
                  <circle cx="2.5" cy="13" r="1.3" />
                  <circle cx="7.5" cy="13" r="1.3" />
                </svg>
              </button>
              <span class="cq-num">
                <span
                  v-if="i === currentIndex"
                  class="cq-bars"
                  aria-label="Now playing"
                >
                  <span /><span /><span />
                </span>
                <template v-else>{{ i + 1 }}</template>
              </span>
              <div class="cq-thumb">
                <img
                  v-if="item.soundtrack?.cover_image_url"
                  :src="item.soundtrack.cover_image_url"
                  :alt="item.soundtrack.game_title"
                />
                <div v-else class="cq-thumb-empty">🎮</div>
              </div>
              <div class="cq-item-main">
                <span class="cq-item-title">{{ itemTitle(item) }}</span>
                <span v-if="itemSubtitle(item)" class="cq-item-sub">{{
                  itemSubtitle(item)
                }}</span>
              </div>
              <span
                class="cq-badge"
                :class="item.video_id ? 'cq-badge--track' : 'cq-badge--album'"
                >{{ item.video_id ? "Track" : "Album" }}</span
              >
              <button
                class="cq-remove"
                aria-label="Remove from queue"
                @click.stop="queue.removeItem(i)"
              >
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
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          </TransitionGroup>
        </aside>
      </div>

      <!-- ══ Mobile: bottom sheet ═══════════════════════════════════════════ -->
      <template v-else>
        <!-- Slim bar above the mini-player -->
        <div class="cq-bar">
          <button
            class="cq-bar-main"
            aria-label="Open queue"
            @click="collapsed = false"
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
              <path d="M18 15l-6-6-6 6" />
            </svg>
            <span class="cq-bar-name">{{ title }}</span>
            <span class="cq-bar-count"
              >{{ currentIndex + 1 }}/{{ items.length }}</span
            >
          </button>
          <button
            class="cq-bar-btn"
            :disabled="!hasPrev"
            aria-label="Previous item"
            @click="queue.prevItem()"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>
          <button
            class="cq-bar-btn"
            :disabled="!hasNext"
            aria-label="Next item"
            @click="queue.nextItem()"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" />
            </svg>
          </button>
        </div>

        <!-- Expanded sheet -->
        <div
          v-if="!collapsed"
          class="cq-sheet-backdrop"
          @click.self="collapsed = true"
        >
          <div class="cq-sheet">
            <div class="cq-sheet-handle-area" @click="collapsed = true">
              <div class="cq-sheet-handle" />
            </div>
            <header class="cq-sheet-header">
              <div class="cq-titles">
                <span class="cq-label">{{ label }}</span>
                <span class="cq-name">{{ title }}</span>
              </div>
              <button
                class="cq-icon-btn"
                aria-label="Close queue"
                @click="queue.close()"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </header>
            <TransitionGroup tag="ol" name="cq" class="cq-list">
              <li
                v-for="(item, i) in items"
                :key="item.id"
                class="cq-item"
                :class="{ active: i === currentIndex, dragging: dragIndex === i }"
                @click="queue.playItem(i)"
              >
                <button
                  class="cq-handle"
                  aria-label="Drag to reorder"
                  @pointerdown.stop.prevent="onHandleDown($event, i)"
                  @click.stop
                >
                  <svg
                    width="10"
                    height="16"
                    viewBox="0 0 10 16"
                    fill="currentColor"
                  >
                    <circle cx="2.5" cy="3" r="1.3" />
                    <circle cx="7.5" cy="3" r="1.3" />
                    <circle cx="2.5" cy="8" r="1.3" />
                    <circle cx="7.5" cy="8" r="1.3" />
                    <circle cx="2.5" cy="13" r="1.3" />
                    <circle cx="7.5" cy="13" r="1.3" />
                  </svg>
                </button>
                <span class="cq-num">
                  <span
                    v-if="i === currentIndex"
                    class="cq-bars"
                    aria-label="Now playing"
                  >
                    <span /><span /><span />
                  </span>
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <div class="cq-thumb">
                  <img
                    v-if="item.soundtrack?.cover_image_url"
                    :src="item.soundtrack.cover_image_url"
                    :alt="item.soundtrack.game_title"
                  />
                  <div v-else class="cq-thumb-empty">🎮</div>
                </div>
                <div class="cq-item-main">
                  <span class="cq-item-title">{{ itemTitle(item) }}</span>
                  <span v-if="itemSubtitle(item)" class="cq-item-sub">{{
                    itemSubtitle(item)
                  }}</span>
                </div>
                <span
                  class="cq-badge"
                  :class="item.video_id ? 'cq-badge--track' : 'cq-badge--album'"
                  >{{ item.video_id ? "Track" : "Album" }}</span
                >
                <button
                  class="cq-remove"
                  aria-label="Remove from queue"
                  @click.stop="queue.removeItem(i)"
                >
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
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            </TransitionGroup>
          </div>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
/* ══ Desktop hover drawer ═══════════════════════════════════════════════════ */
/* Clip layer stays fully inside the viewport (so the tucked-away drawer never
   creates a horizontal scrollbar) and clips everything beyond it. It doesn't
   catch pointer events — only the drawer does. */
.queue-clip {
  position: fixed;
  top: 64px; /* overridden inline with the measured header height */
  bottom: 1rem;
  right: 0;
  width: 400px;
  z-index: 190;
  overflow: hidden;
  pointer-events: none;
}

.queue-drawer {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 340px;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-right: none;
  border-radius: 14px 0 0 14px;
  background: var(--surface);
  box-shadow: -16px 0 52px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  pointer-events: auto;
  /* Tucked away: only the ~32px grip peeks past the right edge. */
  transform: translateX(calc(100% - 32px));
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}
.queue-drawer.open {
  transform: translateX(0);
}

/* Grip — the visible strip when tucked away; fades out once the drawer opens */
.queue-grip {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 32px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  background: var(--surface);
  border-radius: 14px 0 0 14px;
  color: var(--text-secondary);
  transition: opacity 0.25s ease;
}
.queue-drawer.open .queue-grip {
  opacity: 0;
  pointer-events: none;
}
.queue-grip-label {
  writing-mode: vertical-rl;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  max-height: 45vh;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.queue-grip-count {
  writing-mode: vertical-rl;
  font-size: 0.62rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

/* ══ Header / nav ═══════════════════════════════════════════════════════════ */
.cq-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.85rem 0.85rem;
  border-bottom: 1px solid var(--border);
}
.cq-titles {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}
.cq-label {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--accent);
}
.cq-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cq-head-actions {
  display: flex;
  gap: 0.1rem;
  flex-shrink: 0;
}
.cq-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.12s,
    color 0.12s;
}
.cq-icon-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.cq-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.85rem;
  border-bottom: 1px solid var(--border);
}
.cq-nav-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.cq-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: var(--surface-2);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
.cq-nav-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}
.cq-nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

/* ══ Shared item list ═══════════════════════════════════════════════════════ */
.cq-list {
  position: relative; /* anchors leaving rows so the rest can FLIP over them */
  margin: 0;
  padding: 0rem;
  list-style: none;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

/* FLIP transitions: rows slide as they switch places during a drag, new rows
   fade in, and removed rows fade out while the rest slide up.
   Selectors are qualified with .cq-item so they out-specify the plain
   `.cq-item { transition: background }` rule below (which would otherwise
   override the transform transition and make rows teleport). */
.cq-item.cq-move,
.cq-item.cq-enter-active,
.cq-item.cq-leave-active {
  transition:
    transform 0.28s cubic-bezier(0.2, 0, 0.2, 1),
    opacity 0.2s ease;
}
.cq-item.cq-enter-from,
.cq-item.cq-leave-to {
  opacity: 0;
}
.cq-item.cq-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}
.cq-item {
  display: grid;
  grid-template-columns: 16px 1.5rem 40px minmax(0, 1fr) auto 24px;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.5rem;
  cursor: pointer;
  transition: background 0.12s;
}
.cq-item:hover {
  background: var(--surface-2);
}
.cq-item.active {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.cq-item.active .cq-item-title {
  color: var(--accent);
}
.cq-item.dragging {
  opacity: 0.55;
  background: var(--surface-2);
}

/* Drag handle + remove — revealed on row hover (always shown on touch) */
.cq-handle,
.cq-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  padding: 0;
  opacity: 0;
  transition:
    opacity 0.12s,
    color 0.12s,
    background 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.cq-item:hover .cq-handle,
.cq-item:hover .cq-remove,
.cq-item.dragging .cq-handle {
  opacity: 1;
}
.cq-handle {
  width: 16px;
  height: 100%;
  cursor: grab;
  touch-action: none;
}
.cq-handle:active {
  cursor: grabbing;
}
.cq-handle:hover {
  color: var(--text-secondary);
}
.cq-remove {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  cursor: pointer;
}
.cq-remove:hover {
  color: #f87171;
  background: color-mix(in srgb, #f87171 15%, transparent);
}
/* While dragging, the drawer ignores hover-collapse — hint that with a grab
   cursor across the list. */
.queue-drawer.dragging {
  cursor: grabbing;
}
@media (hover: none) {
  .cq-handle,
  .cq-remove {
    opacity: 1;
  }
}
.cq-num {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.cq-thumb {
  width: 40px;
  height: 40px;
  border-radius: 5px;
  overflow: hidden;
  background: var(--surface-2);
}
.cq-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cq-thumb-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}
.cq-item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.cq-item-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cq-item-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cq-badge {
  padding: 0.12rem 0.4rem;
  border-radius: 4px;
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cq-badge--track {
  background: color-mix(in srgb, var(--accent) 85%, black);
  color: #fff;
}
.cq-badge--album {
  background: var(--surface-2);
  color: var(--text-secondary);
}

/* Now-playing bars (mirrors TracklistPanel) */
.cq-bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 11px;
}
.cq-bars span {
  display: block;
  width: 3px;
  height: 11px;
  border-radius: 1.5px;
  background: var(--accent);
  transform-origin: bottom;
  animation: cq-bar-pulse ease-in-out infinite;
}
.cq-bars span:nth-child(1) {
  animation-duration: 1.8s;
  animation-delay: -0.9s;
}
.cq-bars span:nth-child(2) {
  animation-duration: 1.8s;
  animation-delay: -0.3s;
}
.cq-bars span:nth-child(3) {
  animation-duration: 1.8s;
  animation-delay: -1.5s;
}
@keyframes cq-bar-pulse {
  0%,
  100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
}

/* ══ Mobile ═════════════════════════════════════════════════════════════════ */
.cq-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(72px + env(safe-area-inset-bottom));
  z-index: 160;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  height: 44px;
  padding: 0 0.5rem 0 0.25rem;
  background: #161616;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.cq-bar-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 100%;
  padding: 0 0.5rem;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.cq-bar-name {
  flex: 1;
  min-width: 0;
  text-align: left;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cq-bar-count {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
}
.cq-bar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}
.cq-bar-btn:disabled {
  opacity: 0.3;
}

.cq-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 320;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
}
.cq-sheet {
  width: 100%;
  max-height: 80dvh;
  display: flex;
  flex-direction: column;
  background: #0f0f0f;
  border-radius: 16px 16px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom);
}
.cq-sheet-handle-area {
  display: flex;
  justify-content: center;
  padding: 0.75rem 0 0.25rem;
  cursor: pointer;
}
.cq-sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.2);
}
.cq-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 1rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
