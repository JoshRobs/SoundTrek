<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useCollectionStore } from "@/stores/collections";
import { useAuth } from "@/composables/useAuth";
import { itemSummary } from "@/utils/collectionSummary";
import CreateCollectionModal from "./CreateCollectionModal.vue";
import type { Collection } from "@/types/collection";

// Two modes, keyed on whether a track is supplied:
//   album mode (videoId omitted) → add/remove the whole soundtrack.
//   track mode (videoId set)     → add/remove that single track.
const props = defineProps<{
  open: boolean;
  soundtrackId: string;
  soundtrackTitle: string;
  coverImage?: string | null;
  videoId?: string | null;
  trackTitle?: string | null;
}>();

const emit = defineEmits<{ close: [] }>();

const store    = useCollectionStore();
const { user } = useAuth();

const isTrack  = computed(() => !!props.videoId);
const subtitle = computed(() =>
  isTrack.value ? (props.trackTitle ?? "") : props.soundtrackTitle,
);

const checked    = ref<Set<string>>(new Set());
const original   = ref<Set<string>>(new Set());
const saving     = ref(false);
const loading    = ref(false);
const showCreate = ref(false);

const selectedCount = computed(() => checked.value.size);
const hasChanges = computed(() => {
  if (checked.value.size !== original.value.size) return true;
  for (const id of checked.value) if (!original.value.has(id)) return true;
  return false;
});

function coverFor(c: Collection): string | null {
  return (c.collection_items as any)?.[0]?.soundtrack?.cover_image_url ?? null;
}

watch(() => props.open, async (open) => {
  if (!open) return;
  loading.value = true;
  await store.fetchMyCollections();
  const inCollections = isTrack.value
    ? await store.getCollectionsContainingTrack(props.videoId as string)
    : await store.getCollectionsContaining(props.soundtrackId);
  checked.value  = new Set(inCollections);
  original.value = new Set(inCollections);
  loading.value  = false;
});

function toggle(id: string) {
  if (checked.value.has(id)) checked.value.delete(id);
  else checked.value.add(id);
  checked.value = new Set(checked.value);
}

function addTo(collectionId: string) {
  return isTrack.value
    ? store.addTrackToCollection(
        collectionId,
        props.soundtrackId,
        props.videoId as string,
        props.trackTitle ?? "",
      )
    : store.addToCollection(collectionId, props.soundtrackId);
}

function removeFrom(collectionId: string) {
  return isTrack.value
    ? store.removeTrackFromCollection(collectionId, props.videoId as string)
    : store.removeFromCollection(collectionId, props.soundtrackId);
}

async function save() {
  saving.value = true;
  const toAdd    = [...checked.value].filter(id => !original.value.has(id));
  const toRemove = [...original.value].filter(id => !checked.value.has(id));
  await Promise.all([
    ...toAdd.map(id => addTo(id)),
    ...toRemove.map(id => removeFrom(id)),
  ]);
  saving.value = false;
  emit("close");
}

function onCreated(c: Collection) {
  showCreate.value = false;
  checked.value.add(c.id);
  checked.value = new Set(checked.value);
  addTo(c.id);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open && !showCreate"
        class="backdrop"
        @click.self="emit('close')"
      >
        <div class="modal" role="dialog" aria-modal="true">
          <!-- Hero header ─────────────────────────────────────────────── -->
          <div class="hero">
            <div class="hero-glow" aria-hidden="true"></div>
            <button class="close-btn" aria-label="Close" @click="emit('close')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div class="hero-cover">
              <img v-if="coverImage" :src="coverImage" :alt="subtitle" />
              <span v-else class="hero-cover-fallback">🎮</span>
            </div>

            <div class="hero-text">
              <span class="hero-eyebrow">
                {{ isTrack ? "Add track to" : "Add to collection" }}
              </span>
              <h2 class="hero-title">{{ subtitle }}</h2>
            </div>
          </div>

          <!-- Collection list ─────────────────────────────────────────── -->
          <div class="list">
            <div v-if="loading" class="state">
              <span class="spinner" aria-hidden="true"></span>
              <p>Loading collections…</p>
            </div>

            <div v-else-if="!user" class="state">
              <span class="state-icon">🔒</span>
              <p>Sign in to use collections.</p>
            </div>

            <div v-else-if="!store.myCollections.length" class="state">
              <span class="state-icon">📁</span>
              <p>You don't have any collections yet.</p>
              <button class="state-cta" @click="showCreate = true">
                Create your first collection
              </button>
            </div>

            <label
              v-for="c in store.myCollections"
              v-else
              :key="c.id"
              class="row"
              :class="{ selected: checked.has(c.id) }"
            >
              <div class="row-cover">
                <img v-if="coverFor(c)" :src="coverFor(c) as string" :alt="c.name" />
                <span v-else class="row-cover-fallback">♫</span>
              </div>

              <div class="row-info">
                <p class="row-name">{{ c.name }}</p>
                <p class="row-meta">
                  <span>{{ itemSummary(c.collection_items) }}</span>
                  <span class="dot">•</span>
                  <span class="vis" :class="{ pub: c.is_public }">
                    {{ c.is_public ? "Public" : "Private" }}
                  </span>
                </p>
              </div>

              <input
                type="checkbox"
                class="sr-only"
                :checked="checked.has(c.id)"
                @change="toggle(c.id)"
              />
              <span class="check" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="3.2" stroke-linecap="round"
                     stroke-linejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            </label>
          </div>

          <!-- Footer ──────────────────────────────────────────────────── -->
          <div class="modal-footer">
            <button class="btn btn--ghost" @click="showCreate = true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New collection
            </button>
            <button
              class="btn btn--primary"
              :disabled="saving || loading"
              @click="save"
            >
              {{ saving ? "Saving…" : hasChanges ? "Save" : "Done" }}
              <span v-if="selectedCount" class="count-badge">{{ selectedCount }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <CreateCollectionModal
    :open="showCreate"
    @close="showCreate = false"
    @created="onCreated"
  />
</template>

<style scoped>
/* ── Backdrop ──────────────────────────────────────────────────────────── */
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(4, 4, 8, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

/* ── Modal shell ───────────────────────────────────────────────────────── */
.modal {
  position: relative;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, var(--surface-2)) 0%, var(--surface-2) 120px);
  border: 1px solid var(--border);
  border-radius: 18px;
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  max-height: 82dvh;
  overflow: hidden;
  box-shadow:
    0 24px 60px -12px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.02) inset;
  animation: pop 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes pop {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Hero header ───────────────────────────────────────────────────────── */
.hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1.35rem 1.35rem 1.15rem;
  overflow: hidden;
  flex-shrink: 0;
}
.hero-glow {
  position: absolute;
  top: -60%;
  left: -10%;
  width: 60%;
  height: 200%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--accent) 45%, transparent) 0%,
    transparent 65%
  );
  filter: blur(30px);
  opacity: 0.5;
  pointer-events: none;
}
.hero-cover {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 12px;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}
.hero-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero-cover-fallback { font-size: 1.6rem; }
.hero-text {
  position: relative;
  min-width: 0;
  flex: 1;
}
.hero-eyebrow {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-light);
  margin-bottom: 0.2rem;
}
.hero-title {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.15;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.close-btn {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  z-index: 2;
}
.close-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

/* ── List ──────────────────────────────────────────────────────────────── */
.list {
  flex: 1;
  overflow-y: auto;
  padding: 0.35rem 0.6rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.55rem 0.7rem;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.14s, border-color 0.14s;
}
.row:hover { background: rgba(255, 255, 255, 0.04); }
.row.selected {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
}

.row-cover {
  width: 46px;
  height: 46px;
  border-radius: 9px;
  flex-shrink: 0;
  background: var(--surface);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.row-cover img { width: 100%; height: 100%; object-fit: cover; }
.row-cover-fallback { font-size: 1.25rem; color: var(--text-muted); }

.row-info { flex: 1; min-width: 0; }
.row-name {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}
.row-meta .dot { opacity: 0.6; }
.vis.pub { color: var(--accent-2-light); }

/* Custom check indicator (replaces the raw checkbox) */
.check {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--border);
  color: transparent;
  background: transparent;
  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
}
.row:hover .check { border-color: color-mix(in srgb, var(--accent-light) 60%, var(--border)); }
.row.selected .check {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  transform: scale(1.05);
}

/* ── States (loading / empty / signed-out) ─────────────────────────────── */
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 2.2rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}
.state p { margin: 0; }
.state-icon { font-size: 1.8rem; }
.state-cta {
  margin-top: 0.3rem;
  padding: 0.5rem 1rem;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-light);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.state-cta:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
.spinner {
  width: 26px;
  height: 26px;
  border: 2.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Footer ────────────────────────────────────────────────────────────── */
.modal-footer {
  padding: 0.85rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 30%, transparent);
  flex-shrink: 0;
}
.btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.1rem;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.08s;
}
.btn:active { transform: scale(0.97); }
.btn--ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.btn--ghost:hover {
  color: var(--accent-light);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}
.btn--primary {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 4px 14px -4px color-mix(in srgb, var(--accent) 70%, transparent);
}
.btn--primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn--primary:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 0.3rem;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 0.72rem;
  font-weight: 700;
}

/* ── Utility ───────────────────────────────────────────────────────────── */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Backdrop transition ───────────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
