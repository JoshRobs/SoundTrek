import { ref } from "vue";
import { supabase } from "@/lib/supabase";

const LS_KEY = "soundtrek:saved";

// Stored as array newest-first so insertion order is preserved
function loadOrderFromLS(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveToLS(order: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(order));
}

const savedOrder = ref<string[]>(
  typeof window !== "undefined" ? loadOrderFromLS() : [],
);
const savedIds = ref<Set<string>>(new Set(savedOrder.value));

async function syncSaves(userId: string) {
  const { data } = await supabase
    .from("user_saves")
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
      .from("user_saves")
      .upsert(rows, { onConflict: "user_id,soundtrack_id" });
    localStorage.removeItem(LS_KEY);
  }

  // Local items first (most recently added), then server items deduplicated
  const localSet = new Set(localOrder);
  const merged = [
    ...localOrder,
    ...serverOrder.filter((id) => !localSet.has(id)),
  ];

  savedOrder.value = merged;
  savedIds.value = new Set(merged);
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    if (
      (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
      session?.user
    ) {
      syncSaves(session.user.id);
    } else if (event === "SIGNED_OUT") {
      const order = loadOrderFromLS();
      savedOrder.value = order;
      savedIds.value = new Set(order);
    }
  });
}

export function useSaves() {
  function isSaved(id: string): boolean {
    return savedIds.value.has(id);
  }

  function toggleSave(id: string): void {
    const adding = !savedIds.value.has(id);

    const nextIds = new Set(savedIds.value);
    let nextOrder = savedOrder.value;

    if (adding) {
      nextIds.add(id);
      nextOrder = [id, ...savedOrder.value]; // prepend = newest first
    } else {
      nextIds.delete(id);
      nextOrder = savedOrder.value.filter((x) => x !== id);
    }

    savedIds.value = nextIds;
    savedOrder.value = nextOrder;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id;
      if (userId) {
        if (adding) {
          supabase
            .from("user_saves")
            .upsert({ user_id: userId, soundtrack_id: id })
            .then();
        } else {
          supabase
            .from("user_saves")
            .delete()
            .match({ user_id: userId, soundtrack_id: id })
            .then();
        }
      } else {
        saveToLS(nextOrder);
      }
    });
  }

  return { isSaved, toggleSave, savedIds, savedOrder };
}
