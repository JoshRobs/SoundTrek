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
const showCreate = ref(false);

watch(() => props.open, async (open) => {
  if (!open) return;
  await store.fetchMyCollections();
  const inCollections = isTrack.value
    ? await store.getCollectionsContainingTrack(props.videoId as string)
    : await store.getCollectionsContaining(props.soundtrackId);
  checked.value  = new Set(inCollections);
  original.value = new Set(inCollections);
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
    <div v-if="open && !showCreate" class="backdrop" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ isTrack ? "Add Track to Collection" : "Add to Collection" }}</h2>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <p class="subtitle">{{ subtitle }}</p>

        <div class="list">
          <div v-if="!user" class="empty">Sign in to use collections.</div>
          <div v-else-if="!store.myCollections.length" class="empty">You have no collections yet.</div>
          <label v-for="c in store.myCollections" :key="c.id" class="collection-row">
            <div class="c-cover">
              <img
                v-if="(c.collection_items as any)?.[0]?.soundtrack?.cover_image_url"
                :src="(c.collection_items as any)[0].soundtrack.cover_image_url"
                :alt="c.name"
              />
              <span v-else class="c-cover-fallback">♫</span>
            </div>
            <div class="c-info">
              <p class="c-name">{{ c.name }}</p>
              <p class="c-meta">
                {{ itemSummary(c.collection_items) }} ·
                {{ c.is_public ? "Public" : "Private" }}
              </p>
            </div>
            <input type="checkbox" :checked="checked.has(c.id)" @change="toggle(c.id)" />
          </label>
        </div>

        <div class="modal-footer">
          <button class="btn btn--ghost" @click="showCreate = true">+ New Collection</button>
          <button class="btn btn--primary" :disabled="saving" @click="save">
            {{ saving ? "Saving…" : "Done" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <CreateCollectionModal
    :open="showCreate"
    @close="showCreate = false"
    @created="onCreated"
  />
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 1rem; }
.modal { background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 400px; display: flex; flex-direction: column; max-height: 80dvh; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.25rem 0.25rem; flex-shrink: 0; }
.modal-header h2 { font-size: 1rem; font-weight: 700; margin: 0; }
.close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1rem; }
.close-btn:hover { color: var(--text-primary); }
.subtitle { font-size: 0.8rem; color: var(--text-muted); padding: 0 1.25rem 0.75rem; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
.list { flex: 1; overflow-y: auto; padding: 0.25rem 0.75rem; display: flex; flex-direction: column; gap: 0.15rem; }
.empty { font-size: 0.875rem; color: var(--text-muted); padding: 1rem 0.5rem; }
.collection-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.5rem; border-radius: 8px; cursor: pointer; transition: background 0.12s; }
.collection-row:hover { background: var(--surface); }
.c-cover { width: 44px; height: 44px; border-radius: 6px; flex-shrink: 0; background: var(--surface); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.c-cover img { width: 100%; height: 100%; object-fit: cover; }
.c-cover-fallback { font-size: 1.2rem; color: var(--text-muted); }
.c-info { flex: 1; min-width: 0; }
.c-name { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.c-meta { font-size: 0.75rem; color: var(--text-muted); margin: 0; }
.collection-row input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
.modal-footer { padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); flex-shrink: 0; }
.btn { padding: 0.5rem 1.1rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; }
.btn--ghost { background: none; color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); }
.btn--ghost:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.btn--primary { background: var(--accent); color: #fff; }
.btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
