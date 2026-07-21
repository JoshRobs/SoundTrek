import { ref, computed, watch } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { usePlayerStore, type QueueItem } from "@/stores/player";
import type { Collection, CollectionItem } from "@/types/collection";
import type { Soundtrack } from "@/types/soundtrack";

const STORAGE_KEY = "item-queue";

// localStorage shape: soundtracks stored once by id (a queue of albums would
// otherwise serialize the same soundtrack many times).
interface PersistedQueue {
  collectionId: string | null;
  name: string;
  currentIndex: number;
  items: {
    soundtrackId: string;
    video_id: string | null;
    track_title: string | null;
  }[];
  soundtracks: Record<string, Soundtrack>;
}

// The item-level queue. Sits *above* the player's track queue: it holds an
// ordered list of items (a whole soundtrack = "album item", or a single track =
// "track item") and drives the main player to play them one after another,
// while the player's own queue handles navigation *within* the current item.
// A collection is just one way to seed it (startCollection); it also works as a
// free-standing queue built by adding soundtracks/tracks.
export const useQueueStore = defineStore("queue", () => {
  const player = usePlayerStore();

  // The collection this queue was seeded from, if any — metadata only. Null for
  // ad-hoc queues.
  const collectionId = ref<string | null>(null);
  const name = ref("");
  const items = ref<CollectionItem[]>([]);
  const currentIndex = ref(0);

  const isActive = computed(() => items.value.length > 0);
  const fromCollection = computed(() => collectionId.value !== null);
  const currentItem = computed<CollectionItem | null>(
    () => items.value[currentIndex.value] ?? null,
  );
  const hasNext = computed(() => currentIndex.value < items.value.length - 1);
  const hasPrev = computed(() => currentIndex.value > 0);

  // ── Item constructors ───────────────────────────────────────────────────────
  function albumItem(soundtrack: Soundtrack): CollectionItem {
    return {
      id: `q-album-${soundtrack.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      collection_id: collectionId.value ?? "",
      soundtrack_id: soundtrack.id,
      video_id: null,
      track_title: null,
      position: items.value.length,
      added_at: new Date().toISOString(),
      soundtrack,
    };
  }
  function trackItemFor(
    soundtrack: Soundtrack,
    track: { videoId: string; title: string },
  ): CollectionItem {
    return {
      id: `q-track-${track.videoId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      collection_id: collectionId.value ?? "",
      soundtrack_id: soundtrack.id,
      video_id: track.videoId,
      track_title: track.title,
      position: items.value.length,
      added_at: new Date().toISOString(),
      soundtrack,
    };
  }

  // A single-track item as a one-entry player queue.
  function trackQueueItem(item: CollectionItem): QueueItem | null {
    if (!item.soundtrack || !item.video_id) return null;
    return {
      videoId: item.video_id,
      title: item.track_title ?? "",
      unavailable: false,
      soundtrack: item.soundtrack,
    };
  }

  // Drives the main player to play the item at `index`. Album items play their
  // whole soundtrack (the player builds that playlist as the track queue);
  // single-track items play as a one-item queue.
  function playItem(index: number) {
    const item = items.value[index];
    if (!item?.soundtrack) return;
    currentIndex.value = index;
    if (item.video_id) {
      const qi = trackQueueItem(item);
      if (qi) player.playQueue([qi]);
    } else {
      player.playSoundtrack(item.soundtrack);
    }
  }

  // ── Seeding the queue ───────────────────────────────────────────────────────
  // From a collection: play its items in order.
  function startCollection(
    collection: Collection,
    orderedItems: CollectionItem[],
    index = 0,
  ) {
    collectionId.value = collection.id;
    name.value = collection.name;
    items.value = orderedItems;
    persist();
    playItem(index);
  }

  // Fresh ad-hoc queue with a single soundtrack, played immediately. Used when
  // nothing is playing yet.
  function startWithSoundtrack(soundtrack: Soundtrack) {
    collectionId.value = null;
    name.value = "";
    items.value = [];
    items.value = [albumItem(soundtrack)];
    persist();
    playItem(0);
  }

  // Wraps the currently-playing soundtrack as item 0 (without restarting it) and
  // appends `next` as item 1. Used when something is already playing but no
  // item queue exists yet, so "Add to queue" can attach to it seamlessly.
  function attachAndAdd(current: Soundtrack, next: Soundtrack) {
    collectionId.value = null;
    name.value = "";
    items.value = [];
    items.value = [albumItem(current), albumItem(next)];
    currentIndex.value = 0;
    persist();
    // No playItem — `current` is already playing; item 1 plays when it ends.
  }

  // ── Appending to an active queue ────────────────────────────────────────────
  function addAlbum(soundtrack: Soundtrack) {
    if (!isActive.value) return;
    items.value.push(albumItem(soundtrack));
    persist();
  }
  function addTrack(
    soundtrack: Soundtrack,
    track: { videoId: string; title: string },
  ) {
    if (!isActive.value) return;
    items.value.push(trackItemFor(soundtrack, track));
    persist();
  }

  function nextItem() {
    if (hasNext.value) playItem(currentIndex.value + 1);
  }
  function prevItem() {
    if (hasPrev.value) playItem(currentIndex.value - 1);
  }

  // Reorders the queue, keeping the currently-playing item selected by identity
  // (so playback is untouched — only what plays next changes). `to` is the
  // destination index in the array after the moved item is removed.
  function moveItem(from: number, to: number) {
    const n = items.value.length;
    if (from < 0 || from >= n) return;
    const dest = Math.max(0, Math.min(to, n - 1));
    if (from === dest) return;
    const currentId = items.value[currentIndex.value]?.id;
    const arr = items.value.slice();
    const [moved] = arr.splice(from, 1);
    arr.splice(dest, 0, moved);
    items.value = arr;
    if (currentId) {
      const idx = arr.findIndex((it) => it.id === currentId);
      if (idx !== -1) currentIndex.value = idx;
    }
    persist();
  }

  // Removes an item from the queue. Removing the current item advances to the
  // one that takes its place (its former neighbour); removing the last item
  // clears the queue. In-memory only — never touches the saved collection.
  function removeItem(index: number) {
    const n = items.value.length;
    if (index < 0 || index >= n) return;
    const wasCurrent = index === currentIndex.value;
    const arr = items.value.slice();
    arr.splice(index, 1);
    if (!arr.length) {
      close();
      return;
    }
    items.value = arr;
    if (wasCurrent) {
      const next = Math.min(index, arr.length - 1);
      currentIndex.value = next;
      playItem(next);
    } else if (index < currentIndex.value) {
      currentIndex.value = currentIndex.value - 1;
    }
    persist();
  }

  // Clears the queue; playback continues, the panel disappears.
  function close() {
    collectionId.value = null;
    name.value = "";
    items.value = [];
    currentIndex.value = 0;
    persist();
  }

  // Any playback started outside this queue (a soundtrack that isn't in it)
  // detaches it, so cross-item auto-advance can't hijack unrelated playback.
  watch(
    () => player.playRequestId,
    () => {
      if (!isActive.value) return;
      const sId = player.activeSoundtrack?.id;
      const inQueue =
        !!sId && items.value.some((it) => it.soundtrack_id === sId);
      if (!inQueue) close();
    },
  );

  // ── Persistence ────────────────────────────────────────────────────────────
  function persist() {
    if (import.meta.env.SSR) return;
    if (!isActive.value) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const soundtracks: Record<string, Soundtrack> = {};
    const compact = items.value.map((it) => {
      if (it.soundtrack) soundtracks[it.soundtrack_id] = it.soundtrack;
      return {
        soundtrackId: it.soundtrack_id,
        video_id: it.video_id,
        track_title: it.track_title,
      };
    });
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          collectionId: collectionId.value,
          name: name.value,
          currentIndex: currentIndex.value,
          items: compact,
          soundtracks,
        } satisfies PersistedQueue),
      );
    } catch {
      /* storage full — the queue just won't survive a refresh */
    }
  }
  watch(currentIndex, persist);

  // Re-attaches the queue after a reload so the panel reappears site-wide.
  // Playback itself is restored by the player; we only rehydrate the item list
  // + position. Called once from usePlayerControls after the player has had a
  // chance to restore, so activeSoundtrack reflects real playback.
  let restored = false;
  function restore() {
    if (import.meta.env.SSR || restored) return;
    restored = true;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    // Nothing is playing — a queue panel with no audio behind it is confusing.
    if (!player.activeSoundtrack) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    try {
      const data = JSON.parse(raw) as PersistedQueue;
      const rebuilt: CollectionItem[] = [];
      for (const it of data.items ?? []) {
        const soundtrack = data.soundtracks?.[it.soundtrackId];
        if (!soundtrack) continue;
        rebuilt.push({
          id: `q-restore-${it.soundtrackId}-${rebuilt.length}`,
          collection_id: data.collectionId ?? "",
          soundtrack_id: it.soundtrackId,
          video_id: it.video_id,
          track_title: it.track_title,
          position: rebuilt.length,
          added_at: "",
          soundtrack,
        });
      }
      if (!rebuilt.length) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      collectionId.value = data.collectionId ?? null;
      name.value = data.name ?? "";
      items.value = rebuilt;
      currentIndex.value = Math.min(
        Math.max(data.currentIndex ?? 0, 0),
        rebuilt.length - 1,
      );
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    collectionId,
    name,
    items,
    currentIndex,
    isActive,
    fromCollection,
    currentItem,
    hasNext,
    hasPrev,
    startCollection,
    startWithSoundtrack,
    attachAndAdd,
    playItem,
    addAlbum,
    addTrack,
    nextItem,
    prevItem,
    moveItem,
    removeItem,
    close,
    restore,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useQueueStore, import.meta.hot));
}
