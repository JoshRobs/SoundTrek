<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { useCollectionStore } from "@/stores/collections";
import { useQueueStore } from "@/stores/queue";
import { useAuth } from "@/composables/useAuth";
import { itemSummary } from "@/utils/collectionSummary";
import CreateCollectionModal from "@/components/CreateCollectionModal.vue";
import CollectionTrackCard from "@/components/CollectionTrackCard.vue";
import AppIcon from "@/components/AppIcon.vue";
import type { Collection, CollectionItem } from "@/types/collection";

const route = useRoute();
const router = useRouter();
const cStore = useCollectionStore();
const itemQueue = useQueueStore();
const { user } = useAuth();

const collection = ref<Collection | null>(null);
const loading = ref(true);
const notFound = ref(false);
const copied = ref(false);
const showEdit = ref(false);
const editMode = ref(false);

type ViewMode = "grid" | "list";
const viewMode = ref<ViewMode>(
  (localStorage.getItem("collectionViewMode") as ViewMode) || "grid",
);
function setViewMode(mode: ViewMode) {
  viewMode.value = mode;
  localStorage.setItem("collectionViewMode", mode);
}

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

useHead(
  computed(() => ({
    title: collection.value
      ? `${collection.value.name} | SoundTrek`
      : "Collection | SoundTrek",
  })),
);

onMounted(async () => {
  const id = route.params.id as string;
  const data = await cStore.fetchCollection(id);
  loading.value = false;
  if (!data) {
    notFound.value = true;
    return;
  }
  collection.value = data;
});

const isOwner = computed(
  () =>
    !!user.value &&
    !!collection.value &&
    user.value.id === collection.value.user_id,
);

const items = computed<CollectionItem[]>(() =>
  [...(collection.value?.collection_items ?? [])].sort(
    (a, b) => a.position - b.position,
  ),
);

const tracks = computed(() =>
  items.value.map((i) => i.soundtrack).filter(Boolean),
);

// Tied to the item queue's own notion of "what's selected" rather than the
// player's actual video id, so the highlight is stable across the async gap
// between clicking play and the OST queue/video actually loading (that gap
// briefly left currentVideoId null, flickering the highlight off and on).
function isActive(item: CollectionItem): boolean {
  return itemQueue.currentItem?.id === item.id;
}

const summary = computed(() => itemSummary(items.value));

function navigate(item: CollectionItem) {
  if (item.soundtrack)
    router.push(`/soundtrack/${item.soundtrack.slug ?? item.soundtrack.id}`);
}

// Playing any item seeds the item queue with this collection starting at that
// item, so the queue panel appears and playback flows item-to-item from there.
function play(item: CollectionItem) {
  if (!collection.value) return;
  const index = items.value.findIndex((i) => i.id === item.id);
  if (index !== -1)
    itemQueue.startCollection(collection.value, items.value, index);
}

// Plays the whole collection from the top: each item drives its own track
// queue (albums play their playlist, tracks play as a single entry), advancing
// item-to-item via the item queue.
function playAll() {
  if (!collection.value || !items.value.length) return;
  itemQueue.startCollection(collection.value, items.value, 0);
}

async function removeItem(item: CollectionItem) {
  if (!collection.value) return;
  const ok = await cStore.removeItemById(item.id);
  if (ok && collection?.value?.collection_items !== undefined) {
    collection.value.collection_items =
      collection.value.collection_items.filter((i) => i.id !== item.id);
  }
}

// ── Reorder (edit mode) ───────────────────────────────────────────────────────
// List view mirrors the queue's drag-handle reorder; grid view drags the whole
// card. Both live-reorder with <TransitionGroup> FLIP animation and persist the
// new positions on drop. Hit-testing uses geometry captured at drag start, so
// it's stable regardless of the in-flight move animations.
const dragIndex = ref<number | null>(null);
let dragMode: "list" | "grid" = "list";
let dragOrigOrder: string[] = [];
// list geometry
let listTop = 0;
let rowH = 0;
// grid geometry
let gridLeft = 0;
let gridTop = 0;
let cellW = 1;
let cellH = 1;
let gridCols = 1;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(v, hi));

// Reorders the displayed items and rewrites their positions so the `items`
// computed re-sorts into the new order (objects are shared with the store).
function reorder(from: number, to: number) {
  const arr = items.value.slice();
  const dest = clamp(to, 0, arr.length - 1);
  if (from === dest) return;
  const [moved] = arr.splice(from, 1);
  arr.splice(dest, 0, moved);
  arr.forEach((it, i) => (it.position = i));
}

function startDrag(index: number) {
  dragOrigOrder = items.value.map((i) => i.id);
  dragIndex.value = index;
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragUp);
}

function onListHandleDown(e: PointerEvent, index: number) {
  e.preventDefault();
  const row = (e.currentTarget as HTMLElement).closest(
    ".list-row",
  ) as HTMLElement | null;
  const list = row?.parentElement as HTMLElement | null;
  if (!row || !list) return;
  const first = (list.firstElementChild as HTMLElement | null) ?? row;
  dragMode = "list";
  listTop = first.getBoundingClientRect().top;
  rowH = row.getBoundingClientRect().height || 1;
  startDrag(index);
}

function onCardDown(e: PointerEvent, index: number) {
  if (!editMode.value) return;
  // Pressing the remove (trash) button shouldn't start a drag.
  if ((e.target as HTMLElement).closest(".overlay-remove")) return;
  e.preventDefault();
  const card = (e.currentTarget as HTMLElement).closest(
    ".track-card",
  ) as HTMLElement | null;
  const grid = card?.parentElement as HTMLElement | null;
  if (!card || !grid) return;
  const gr = grid.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  const cs = getComputedStyle(grid);
  const colGap = parseFloat(cs.columnGap) || 0;
  const rowGap = parseFloat(cs.rowGap) || 0;
  dragMode = "grid";
  gridLeft = gr.left;
  gridTop = gr.top;
  cellW = cr.width + colGap;
  cellH = cr.height + rowGap;
  gridCols = Math.max(1, Math.round((gr.width + colGap) / cellW));
  startDrag(index);
}

function onDragMove(e: PointerEvent) {
  if (dragIndex.value === null) return;
  const n = items.value.length;
  let target: number;
  if (dragMode === "list") {
    target = Math.floor((e.clientY - listTop) / rowH);
  } else {
    const col = clamp(
      Math.floor((e.clientX - gridLeft) / cellW),
      0,
      gridCols - 1,
    );
    const row = Math.max(0, Math.floor((e.clientY - gridTop) / cellH));
    target = row * gridCols + col;
  }
  target = clamp(target, 0, n - 1);
  if (target !== dragIndex.value) {
    reorder(dragIndex.value, target);
    dragIndex.value = target;
  }
}

function onDragUp() {
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", onDragUp);
  const moved =
    dragIndex.value !== null &&
    items.value.some((it, i) => dragOrigOrder[i] !== it.id);
  dragIndex.value = null;
  if (moved && collection.value) {
    cStore.reorderItems(
      items.value.map((it, i) => ({ id: it.id, position: i })),
    );
  }
}

async function copyLink() {
  await navigator.clipboard.writeText(window.location.href);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

async function deleteCollection() {
  if (!collection.value) return;
  if (!confirm(`Delete "${collection.value.name}"? This cannot be undone.`))
    return;
  await cStore.deleteCollection(collection.value.id);
  router.push("/collections");
}

function onUpdated() {
  showEdit.value = false;
  cStore.fetchCollection(route.params.id as string).then((d) => {
    if (d) collection.value = d;
  });
}
</script>

<template>
  <div class="page">
    <div v-if="loading" class="state">
      <div class="spinner" style="--spinner-size: 28px" />
    </div>

    <div v-else-if="notFound" class="state">
      <p class="empty">Collection not found or is private.</p>
    </div>

    <template v-else-if="collection">
      <button class="back-btn" @click="router.back()">
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
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </button>

      <!-- Blurred backdrop -->
      <div
        class="backdrop"
        :style="
          tracks[0]?.cover_image_url
            ? `background-image: url('${tracks[0].cover_image_url}')`
            : ''
        "
      />

      <div class="hero">
        <div
          class="hero-cover"
          :class="{ 'hero-cover--mosaic': tracks.length >= 4 }"
        >
          <div v-if="tracks.length >= 4" class="cover-grid">
            <img
              v-for="(t, i) in tracks.slice(0, 4)"
              :key="i"
              :src="(t as any).cover_image_url ?? ''"
              :alt="(t as any).game_title"
            />
          </div>
          <img
            v-else-if="tracks[0]?.cover_image_url"
            :src="tracks[0].cover_image_url"
            :alt="(tracks[0] as any).game_title"
            class="cover-single"
          />
          <div v-else class="cover-empty">♫</div>
        </div>

        <div class="hero-info">
          <p class="hero-label">
            {{
              collection.is_public ? "Public Collection" : "Private Collection"
            }}
          </p>
          <h1 class="hero-title">{{ collection.name }}</h1>
          <p v-if="collection.description" class="hero-desc">
            {{ collection.description }}
          </p>
          <p class="hero-meta">
            By {{ collection.creator_name ?? "Unknown" }} · {{ summary }}
          </p>
          <div v-if="collection.theme_tags?.length" class="tags">
            <span v-for="t in collection.theme_tags" :key="t" class="tag">{{
              t
            }}</span>
          </div>

          <div class="hero-actions">
            <button
              v-if="items.length"
              class="btn-action btn-action--play"
              @click="playAll"
            >
              <AppIcon name="play-icon" :size="18" />
              Play
            </button>
            <button class="btn-action" @click="copyLink">
              {{ copied ? "Copied!" : "Copy Link" }}
            </button>
            <template v-if="isOwner">
              <button class="btn-action" @click="showEdit = true">
                Edit Details
              </button>
              <button
                class="btn-action"
                :class="{ 'btn-action--active': editMode }"
                @click="editMode = !editMode"
              >
                {{ editMode ? "Done Editing" : "Edit Tracks" }}
              </button>
              <button
                class="btn-action btn-action--danger"
                @click="deleteCollection"
              >
                Delete
              </button>
            </template>
          </div>
        </div>
      </div>

      <div class="separator" />

      <div v-if="items.length" class="list-header">
        <div class="view-toggle" role="group" aria-label="View mode">
          <button
            class="view-toggle-btn"
            :class="{ 'view-toggle-btn--active': viewMode === 'grid' }"
            aria-label="Grid view"
            :aria-pressed="viewMode === 'grid'"
            @click="setViewMode('grid')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </button>
          <button
            class="view-toggle-btn"
            :class="{ 'view-toggle-btn--active': viewMode === 'list' }"
            aria-label="List view"
            :aria-pressed="viewMode === 'list'"
            @click="setViewMode('list')"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
        </div>
      </div>

      <TransitionGroup
        v-if="items.length && viewMode === 'grid'"
        tag="div"
        name="reorder"
        class="track-grid"
      >
        <div
          v-for="(item, i) in items"
          :key="item.id"
          class="track-card"
          :class="{
            active: isActive(item),
            editing: editMode,
            dragging: dragIndex === i,
          }"
          @pointerdown="onCardDown($event, i)"
        >
          <!-- Affordance only — dragging it is the same as dragging the card. -->
          <div v-if="editMode" class="card-handle" aria-hidden="true">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2.5" cy="3" r="1.3" />
              <circle cx="7.5" cy="3" r="1.3" />
              <circle cx="2.5" cy="8" r="1.3" />
              <circle cx="7.5" cy="8" r="1.3" />
              <circle cx="2.5" cy="13" r="1.3" />
              <circle cx="7.5" cy="13" r="1.3" />
            </svg>
          </div>
          <CollectionTrackCard
            v-if="item.soundtrack"
            :soundtrack="item.soundtrack"
            :track="item.video_id ? { title: item.track_title ?? '' } : null"
            :edit-mode="editMode"
            @click="navigate(item)"
            @play="play(item)"
            @remove="removeItem(item)"
          />
        </div>
      </TransitionGroup>

      <TransitionGroup
        v-else-if="items.length"
        tag="div"
        name="reorder"
        class="track-list"
      >
        <div
          v-for="(item, i) in items"
          :key="item.id"
          class="list-row"
          :class="{
            active: isActive(item),
            editing: editMode,
            dragging: dragIndex === i,
          }"
          @click="!editMode && navigate(item)"
        >
          <button
            v-if="editMode"
            class="list-handle"
            aria-label="Drag to reorder"
            @pointerdown.stop.prevent="onListHandleDown($event, i)"
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
          <div class="list-thumb">
            <img
              v-if="item.soundtrack?.cover_image_url"
              :src="item.soundtrack.cover_image_url"
              :alt="item.soundtrack.game_title"
            />
            <div v-else class="list-thumb-empty">🎮</div>
          </div>

          <div class="list-main">
            <p class="list-title">{{ itemTitle(item) }}</p>
            <p v-if="itemSubtitle(item)" class="list-sub">
              {{ itemSubtitle(item) }}
            </p>
          </div>

          <span
            class="list-badge"
            :class="item.video_id ? 'list-badge--track' : 'list-badge--album'"
            >{{ item.video_id ? "Track" : "Album" }}</span
          >

          <span class="list-year">{{ item.soundtrack?.release_year }}</span>

          <button
            v-if="!editMode"
            class="list-action"
            aria-label="Play"
            @click.stop="play(item)"
          >
            <AppIcon name="play-icon" :size="18" />
          </button>
          <button
            v-else
            class="list-action list-action--remove"
            aria-label="Remove from collection"
            @click.stop="removeItem(item)"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"
              />
            </svg>
          </button>
        </div>
      </TransitionGroup>
      <p v-else class="empty">No tracks in this collection yet.</p>
    </template>
  </div>

  <CreateCollectionModal
    :open="showEdit"
    :editing="collection"
    @close="showEdit = false"
    @updated="onUpdated"
  />
</template>

<style scoped>
.page {
  flex: 1;
  position: relative;
  min-height: 90vh;
  background: var(--bg);
}

/* ── Blurred backdrop ─────────────────────────────────────────────────────── */
.backdrop {
  position: absolute;
  inset: 0;
  height: 480px;
  background-size: cover;
  background-position: center;
  filter: blur(80px) brightness(0.25) saturate(1.4);
  transform: scale(1);
  pointer-events: none;
}

.backdrop::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 50%, var(--bg) 100%);
}
.back-btn {
  position: absolute;
  top: 1.25rem;
  left: 1.5rem;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem 0.4rem 0.5rem;
  border: none;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.2);
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}
.back-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.state {
  display: flex;
  justify-content: center;
  padding: 4rem;
}
.empty {
  color: var(--text-muted);
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
}

/* Hero */
.hero {
  position: relative;
  padding: 4rem 3rem 3rem;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 2rem;
  align-items: flex-end;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
}
.hero-cover {
  width: 240px;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface-2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
.hero-cover--mosaic {
  aspect-ratio: 1 / 1;
}
.cover-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  height: 100%;
}
.cover-grid img {
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}
.cover-single {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  color: var(--text-muted);
}
.hero-info {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.hero-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 0;
}
.hero-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.75rem, 5vw, 4rem);
  font-weight: 400;
  letter-spacing: 0.03em;
  margin: 0;
  line-height: 1;
}
.hero-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}
.hero-meta {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin: 0;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.tag {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-radius: 99px;
  padding: 0.2rem 0.65rem;
  font-size: 0.95rem;
}
.hero-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.5rem;
}
.btn-action {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
}
.btn-action:hover {
  border-color: var(--text-muted);
  color: var(--text-primary);
}

.btn-action--play {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding-left: 0.85rem;
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.btn-action--play:hover {
  background: var(--accent-hover, var(--accent));
  border-color: var(--accent-hover, var(--accent));
  color: #fff;
}

.btn-action--play:disabled {
  opacity: 0.7;
  cursor: default;
}

.btn-spinner {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: btn-spin 0.7s linear infinite;
}

@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}
.btn-action--active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.btn-action--danger:hover {
  border-color: #f87171;
  color: #f87171;
}

/* Separator */
.separator {
  position: relative;
  max-width: 1200px;
  margin: 0 auto 2.5rem;
  padding: 0 3rem;
}

.separator::after {
  content: "";
  display: block;
  height: 1px;
  background: var(--border);
}

/* View toggle header */
.list-header {
  position: relative;
  max-width: 1200px;
  margin: 0 auto 1.25rem;
  padding: 0 3rem;
  display: flex;
  justify-content: flex-end;
}
.view-toggle {
  display: inline-flex;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-2);
}
.view-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    color 0.12s,
    background 0.12s;
}
.view-toggle-btn:hover {
  color: var(--text-primary);
}
.view-toggle-btn--active {
  background: var(--accent);
  color: #fff;
}
.view-toggle-btn--active:hover {
  color: #fff;
}

/* Track grid */
.track-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
  gap: 1.25rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 3rem 6rem;
}

/* Track list */
.track-list {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 3rem 6rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.list-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto auto 40px;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}
/* Edit mode: prepend a drag-handle column. */
.list-row.editing {
  grid-template-columns: 20px 48px minmax(0, 1fr) auto auto 40px;
}
.list-row.dragging {
  opacity: 0.55;
  background: var(--surface-2);
}
.list-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: grab;
  touch-action: none;
}
.list-handle:hover {
  color: var(--text-secondary);
}
.list-handle:active {
  cursor: grabbing;
}
/* FLIP: qualified with .list-row so it out-specifies the base
   `.list-row { transition: background }` rule (else rows would teleport). */
.list-row.reorder-move {
  transition: transform 0.28s cubic-bezier(0.2, 0, 0.2, 1);
}
/* Zebra striping — kept before :hover/.active so those still win on equal
   specificity. */
.list-row:nth-child(odd) {
  background: color-mix(in srgb, var(--text-primary) 4%, transparent);
}
.list-row:hover {
  background: var(--surface-2);
}
.list-row.active {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}
.list-row.active .list-title {
  color: var(--accent);
}
.list-thumb {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface-2);
  flex-shrink: 0;
}
.list-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.list-thumb-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}
.list-main {
  min-width: 0;
}
.list-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.list-sub {
  margin: 0.1rem 0 0;
  font-size: 0.8rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.list-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.list-badge--track {
  background: color-mix(in srgb, var(--accent) 85%, black);
  color: #fff;
}
.list-badge--album {
  background: var(--surface-2);
  color: var(--text-secondary);
}
.list-year {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.list-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
.list-action:hover {
  background: var(--accent);
  color: #fff;
}
.list-action--remove:hover {
  background: color-mix(in srgb, #f87171 25%, transparent);
  color: #f87171;
}

.track-card {
  position: relative;
}

.track-card.active :deep(.cover-wrap) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Edit mode: the whole card is a drag target. The inner card is a <button>
   with cursor:pointer, so override it to grab (but keep pointer on delete). */
.track-card.editing {
  cursor: grab;
  touch-action: none;
}
.track-card.editing :deep(.cover-card),
.track-card.editing :deep(.cover-card):hover {
  cursor: grab;
}
.track-card.editing:active,
.track-card.editing:active :deep(.cover-card) {
  cursor: grabbing;
}
.track-card.editing :deep(.overlay-remove) {
  cursor: pointer;
}
/* Don't lift the card on hover while editing — it fights the drag. */
.track-card.editing :deep(.cover-card):hover {
  transform: none;
  box-shadow: none;
}
.track-card.dragging {
  opacity: 0.5;
}

/* Reorder handle — a visual affordance in the card's corner. */
.card-handle {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.85);
  cursor: grab;
  transition: background 0.15s;
}
.card-handle:hover {
  background: rgba(0, 0, 0, 0.75);
}
.track-card.editing:active .card-handle {
  cursor: grabbing;
}
/* FLIP for grid reordering (cards slide to their new cells). */
.track-card.reorder-move {
  transition: transform 0.28s cubic-bezier(0.2, 0, 0.2, 1);
}

@media (max-width: 768px) {
  .back-btn {
    top: 1rem;
    left: 1rem;
    font-size: 0.9rem;
  }
  .hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 4rem 1rem 1.5rem;
    gap: 1.25rem;
    margin-bottom: 2rem;
  }
  .hero-cover {
    width: min(220px, 60vw);
    align-self: center;
  }
  .hero-info {
    width: 100%;
    min-width: 0;
  }
  .hero-title {
    font-size: 2.2rem;
    overflow-wrap: anywhere;
  }
  .separator {
    padding: 0 1rem;
    margin-bottom: 2rem;
  }
  .track-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    padding: 0 1rem 5rem;
  }
  .list-header {
    padding: 0 1rem;
  }
  .track-list {
    padding: 0 1rem 5rem;
  }
  .list-row {
    grid-template-columns: 44px minmax(0, 1fr) auto 36px;
    gap: 0.6rem;
    padding: 0.4rem 0.5rem;
  }
  .list-row.editing {
    grid-template-columns: 18px 44px minmax(0, 1fr) auto 36px;
  }
  .list-thumb {
    width: 44px;
    height: 44px;
  }
  .list-year {
    display: none;
  }
}
</style>
