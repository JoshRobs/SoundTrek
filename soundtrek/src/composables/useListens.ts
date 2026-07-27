import { ref } from "vue";
import { supabase } from "@/lib/supabase";

// Per-user listen history. Mirrors useLikes: an ordered id list held in
// localStorage for anonymous visitors, synced up into the listen_history table
// on sign-in, and driven from that table thereafter. This is the foundation the
// "Recently listened" rail and "Curated for you" recommendations build on.
//
// listenedOrder is newest-first and deduped — replaying a soundtrack moves it to
// the front rather than adding a second entry. Resolve the ids to full
// Soundtracks via the soundtrack store when rendering (same pattern as LikedView
// with likedOrder).

const LS_KEY = "soundtrek:listens";
// Cap the retained history so localStorage and the sync payload stay small; the
// recency tail past this is not useful for "recently listened" or v1 recs.
const CAP = 100;

function loadOrderFromLS(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveToLS(order: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(order));
  } catch {
    /* storage full — history just won't persist across sessions */
  }
}

// Newest-first, deduped list of soundtrack ids.
const listenedOrder = ref<string[]>(
  typeof window !== "undefined" ? loadOrderFromLS() : [],
);

// On sign-in, push any anonymous local history up to the server (without
// clobbering the recency of soundtracks already recorded there), then adopt the
// merged, server-backed order — same shape as syncLikes.
async function syncListens(userId: string) {
  const { data } = await supabase
    .from("listen_history")
    .select("soundtrack_id")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(CAP);

  const serverOrder = (data ?? []).map(
    (r: { soundtrack_id: string }) => r.soundtrack_id,
  );

  const localOrder = loadOrderFromLS();
  if (localOrder.length > 0) {
    // Stagger played_at so the local list's relative recency is preserved on the
    // server; ignoreDuplicates leaves already-recorded rows (and their real
    // played_at) untouched.
    const now = Date.now();
    const rows = localOrder.map((id, i) => ({
      user_id: userId,
      soundtrack_id: id,
      played_at: new Date(now - i * 1000).toISOString(),
    }));
    await supabase
      .from("listen_history")
      .upsert(rows, { onConflict: "user_id,soundtrack_id", ignoreDuplicates: true });
    localStorage.removeItem(LS_KEY);
  }

  // Local items first (most recently played on this device), then server-only.
  const localSet = new Set(localOrder);
  listenedOrder.value = [
    ...localOrder,
    ...serverOrder.filter((id) => !localSet.has(id)),
  ].slice(0, CAP);
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    if (
      (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
      session?.user
    ) {
      syncListens(session.user.id);
    } else if (event === "SIGNED_OUT") {
      listenedOrder.value = loadOrderFromLS();
    }
  });
}

export function useListens() {
  // Record a play of a soundtrack. Moves it to the front of the history and
  // persists — to the server for signed-in users, localStorage otherwise.
  function recordListen(soundtrackId: string) {
    if (!soundtrackId || typeof window === "undefined") return;

    const nextOrder = [
      soundtrackId,
      ...listenedOrder.value.filter((x) => x !== soundtrackId),
    ].slice(0, CAP);
    listenedOrder.value = nextOrder;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id;
      if (userId) {
        supabase
          .from("listen_history")
          .upsert(
            {
              user_id: userId,
              soundtrack_id: soundtrackId,
              played_at: new Date().toISOString(),
            },
            { onConflict: "user_id,soundtrack_id" },
          )
          .then();
      } else {
        saveToLS(nextOrder);
      }
    });
  }

  return { listenedOrder, recordListen };
}
