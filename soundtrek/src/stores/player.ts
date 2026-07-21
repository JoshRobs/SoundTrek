import { ref, computed, watch } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import type { Soundtrack } from "@/types/soundtrack";

// One entry in the player's playback queue.
export interface QueueItem {
  videoId: string;
  title: string;
  unavailable: boolean;
  // The soundtrack this track came from. The player header, like button,
  // Spotify tab, and streaming links all follow the current item's soundtrack,
  // so a queue mixing several OSTs renders correctly per track.
  soundtrack: Soundtrack;
}

// localStorage shape: soundtracks are stored once by id rather than inline
// per item, so a 500-track OST queue doesn't serialize 500 copies of it.
interface PersistedQueue {
  index: number;
  items: {
    videoId: string;
    title: string;
    unavailable: boolean;
    soundtrackId: string;
  }[];
  soundtracks: Record<string, Soundtrack>;
}

const QUEUE_STORAGE_KEY = "player-queue";

// Global playback queue. Lives in Pinia rather than usePlayerControls so any
// view can enqueue tracks; the mounted player component (desktop or mobile)
// drives actual playback from this state via usePlayerControls.
export const usePlayerStore = defineStore("player", () => {
  const queue = ref<QueueItem[]>([]);
  const currentTrackIndex = ref(0);

  // The soundtrack playback was started from. nowPlaying falls back to it
  // while the queue isn't driving playback: single videos, Spotify-only
  // soundtracks, and the native-list fallback when the proxy is unreachable.
  const activeSoundtrack = ref<Soundtrack | null>(null);

  // True when the queue was built or modified by the user (enqueued tracks)
  // rather than auto-built from an OST playlist. Custom queues survive source
  // switches and persist across sessions; OST queues are just refetched.
  const isCustomQueue = ref(false);

  // True while the YT player is actually driven by the queue — set by
  // usePlayerControls. nowPlaying only follows the queue in that case, so
  // tracks enqueued behind a playing single video don't flip the header
  // before they start playing.
  const queueActive = ref(false);

  // Bumped whenever playback should (re)initialize. usePlayerControls watches
  // this rather than nowPlaying, so moving through a mixed queue can change
  // nowPlaying without tearing the player down.
  const playRequestId = ref(0);

  // Set by playFromTrack so initPlayer knows which video to start at after
  // the OST queue is built. Consumed (nulled) inside initPlayer.
  const pendingVideoId = ref<string | null>(null);

  // Bumped by seekToQueueIndex to tell the composable to call playTrackAt
  // without triggering a full player reinit.
  const seekRequestIndex = ref(0);
  const seekRequestSeq = ref(0);

  // The video ID actually playing in the YT iframe — only set while the queue
  // is driving playback. Components that need to highlight the active row
  // (e.g. TracklistPanel) read this instead of reaching into the composable.
  const currentVideoId = computed<string | null>(() =>
    queueActive.value
      ? (queue.value[currentTrackIndex.value]?.videoId ?? null)
      : null,
  );

  const nowPlaying = computed<Soundtrack | null>(
    () =>
      (queueActive.value
        ? queue.value[currentTrackIndex.value]?.soundtrack
        : undefined) ?? activeSoundtrack.value,
  );

  function playSoundtrack(s: Soundtrack | null) {
    // Same-object re-play was a silent no-op when nowPlaying was a plain ref
    // (Vue refs don't trigger on identical assignment) — keep that contract.
    if (s === activeSoundtrack.value) return;
    activeSoundtrack.value = s;
    queue.value = [];
    currentTrackIndex.value = 0;
    isCustomQueue.value = false;
    playRequestId.value++;
  }

  // Play a specific track within a soundtrack. If the soundtrack is already
  // active, forces a reinit so initPlayer can seek to the right position.
  // If it's different, delegates to playSoundtrack (which clears the queue).
  function playFromTrack(s: Soundtrack, videoId: string) {
    pendingVideoId.value = videoId;
    if (s === activeSoundtrack.value) {
      // Same OST — bypass the same-object guard in playSoundtrack and reinit
      queue.value = [];
      currentTrackIndex.value = 0;
      isCustomQueue.value = false;
      playRequestId.value++;
    } else {
      playSoundtrack(s);
    }
  }

  // Jump to a queue index that already exists, without a full player reinit.
  // Sets queueActive so the composable's playTrackAt takes the loadVideoById path.
  function seekToQueueIndex(index: number) {
    queueActive.value = true;
    seekRequestIndex.value = index;
    seekRequestSeq.value++;
  }

  function enqueueTrack(
    s: Soundtrack,
    track: { videoId: string; title: string; unavailable?: boolean },
  ) {
    const item: QueueItem = {
      videoId: track.videoId,
      title: track.title,
      unavailable: !!track.unavailable,
      soundtrack: s,
    };
    isCustomQueue.value = true;
    if (!activeSoundtrack.value) {
      // Nothing playing — boot the player on a fresh one-track queue
      activeSoundtrack.value = s;
      queue.value = [item];
      currentTrackIndex.value = 0;
      playRequestId.value++;
      return;
    }
    queue.value.push(item);
  }

  // Replaces the queue with a fully-built list and starts playback from the
  // first available track — used to play a whole collection (album items
  // expanded to their tracks, track items as single entries). Like any custom
  // queue it persists and survives source switches.
  function playQueue(items: QueueItem[]) {
    if (items.length === 0) return;
    const firstAvailable = items.findIndex((i) => !i.unavailable);
    queue.value = items;
    currentTrackIndex.value = firstAvailable === -1 ? 0 : firstAvailable;
    isCustomQueue.value = true;
    activeSoundtrack.value = items[currentTrackIndex.value].soundtrack;
    playRequestId.value++;
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  // Only custom queues are persisted; OST queues restore via the existing
  // player-track + player-video-id path (refetched from the proxy).
  function persistQueue() {
    if (import.meta.env.SSR) return;
    if (!isCustomQueue.value || queue.value.length === 0) {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
      return;
    }
    const soundtracks: Record<string, Soundtrack> = {};
    const items = queue.value.map((i) => {
      soundtracks[i.soundtrack.id] = i.soundtrack;
      return {
        videoId: i.videoId,
        title: i.title,
        unavailable: i.unavailable,
        soundtrackId: i.soundtrack.id,
      };
    });
    const data: PersistedQueue = {
      index: currentTrackIndex.value,
      items,
      soundtracks,
    };
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full — playback still works, the queue just won't survive a refresh */
    }
  }

  watch([queue, currentTrackIndex, isCustomQueue], persistQueue, {
    deep: true,
  });

  // Restores a persisted custom queue; returns false when there is none so
  // the caller can fall back to the OST restore path.
  function restoreQueue(): boolean {
    if (import.meta.env.SSR) return false;
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as PersistedQueue;
      const items: QueueItem[] = [];
      for (const i of data.items ?? []) {
        const soundtrack = data.soundtracks?.[i.soundtrackId];
        if (!i.videoId || !soundtrack) continue;
        items.push({
          videoId: i.videoId,
          title: i.title ?? "",
          unavailable: !!i.unavailable,
          soundtrack,
        });
      }
      if (items.length === 0) return false;
      queue.value = items;
      currentTrackIndex.value = Math.min(
        Math.max(data.index ?? 0, 0),
        items.length - 1,
      );
      isCustomQueue.value = true;
      activeSoundtrack.value = items[currentTrackIndex.value].soundtrack;
      playRequestId.value++;
      return true;
    } catch {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
      return false;
    }
  }

  return {
    queue,
    currentTrackIndex,
    currentVideoId,
    activeSoundtrack,
    isCustomQueue,
    queueActive,
    playRequestId,
    pendingVideoId,
    seekRequestIndex,
    seekRequestSeq,
    nowPlaying,
    playSoundtrack,
    playFromTrack,
    seekToQueueIndex,
    enqueueTrack,
    playQueue,
    restoreQueue,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePlayerStore, import.meta.hot));
}
