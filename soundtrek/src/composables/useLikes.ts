import { ref } from "vue";
import { supabase } from "@/lib/supabase";

const LS_KEY = "soundtrek:liked";
// The retired saves feature stored anonymous lists under this key — merged
// into likes on first load so nobody loses their list.
const LEGACY_SAVED_KEY = "soundtrek:saved";

// Stored as array newest-first so insertion order is preserved
function loadOrderFromLS(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const order = raw ? (JSON.parse(raw) as string[]) : [];

    const legacyRaw = localStorage.getItem(LEGACY_SAVED_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as string[];
      const seen = new Set(order);
      for (const id of legacy) if (!seen.has(id)) order.push(id);
      localStorage.removeItem(LEGACY_SAVED_KEY);
      localStorage.setItem(LS_KEY, JSON.stringify(order));
    }

    return order;
  } catch {
    return [];
  }
}

function saveToLS(order: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(order));
}

const likedOrder = ref<string[]>(
  typeof window !== "undefined" ? loadOrderFromLS() : [],
);
const likedIds = ref<Set<string>>(new Set(likedOrder.value));

async function syncLikes(userId: string) {
  const { data } = await supabase
    .from("user_likes")
    .select("soundtrack_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const serverOrder = (data ?? []).map(
    (r: { soundtrack_id: string }) => r.soundtrack_id,
  );

  const localOrder = loadOrderFromLS();
  if (localOrder.length > 0) {
    const rows = localOrder.map((id) => ({
      user_id: userId,
      soundtrack_id: id,
    }));
    await supabase
      .from("user_likes")
      .upsert(rows, { onConflict: "user_id,soundtrack_id" });
    localStorage.removeItem(LS_KEY);
  }

  // Local items first (most recently added), then server items deduplicated
  const localSet = new Set(localOrder);
  const merged = [
    ...localOrder,
    ...serverOrder.filter((id) => !localSet.has(id)),
  ];

  likedOrder.value = merged;
  likedIds.value = new Set(merged);
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    if (
      (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
      session?.user
    ) {
      syncLikes(session.user.id);
    } else if (event === "SIGNED_OUT") {
      const order = loadOrderFromLS();
      likedOrder.value = order;
      likedIds.value = new Set(order);
    }
  });
}

export function useLikes() {
  function isLiked(id: string): boolean {
    return likedIds.value.has(id);
  }

  function toggleLike(id: string): 1 | -1 {
    const adding = !likedIds.value.has(id);

    const nextIds = new Set(likedIds.value);
    let nextOrder = likedOrder.value;

    if (adding) {
      nextIds.add(id);
      nextOrder = [id, ...likedOrder.value]; // prepend = newest first
    } else {
      nextIds.delete(id);
      nextOrder = likedOrder.value.filter((x) => x !== id);
    }

    likedIds.value = nextIds;
    likedOrder.value = nextOrder;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id;
      if (userId) {
        if (adding) {
          supabase
            .from("user_likes")
            .upsert({ user_id: userId, soundtrack_id: id })
            .then();
        } else {
          supabase
            .from("user_likes")
            .delete()
            .match({ user_id: userId, soundtrack_id: id })
            .then();
        }
      } else {
        saveToLS(nextOrder);
      }
    });

    return adding ? 1 : -1;
  }

  return { isLiked, toggleLike, likedIds, likedOrder };
}
