import { usePlayerStore } from "@/stores/player";
import { useQueueStore } from "@/stores/queue";
import type { Soundtrack } from "@/types/soundtrack";

// Shared "add to queue" behaviour so any view (soundtrack page, cards, …) can
// add a whole soundtrack to the item queue without re-deriving the rules.
export function useQueueActions() {
  const player = usePlayerStore();
  const queue = useQueueStore();

  // Adds a whole soundtrack to the item queue as a single album item — never
  // flattened into individual tracks:
  //  • a queue is already running → append it to the end;
  //  • nothing is playing → start a queue with it and play;
  //  • something is playing but there's no queue yet → wrap the current
  //    soundtrack as item 1 and add this one as item 2.
  function addSoundtrack(soundtrack: Soundtrack) {
    if (queue.isActive) {
      queue.addAlbum(soundtrack);
    } else if (!player.activeSoundtrack) {
      queue.startWithSoundtrack(soundtrack);
    } else {
      queue.attachAndAdd(player.activeSoundtrack, soundtrack);
    }
  }

  return { addSoundtrack };
}
