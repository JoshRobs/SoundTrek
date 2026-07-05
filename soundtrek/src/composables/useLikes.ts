import { ref } from "vue";
import { supabase } from "@/lib/supabase";

const LS_KEY = "soundtrek:liked";

function loadFromLS(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveToLS(ids: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
}

const likedIds = ref<Set<string>>(
  typeof window !== "undefined" ? loadFromLS() : new Set(),
);

async function syncLikes(userId: string) {
  const { data } = await supabase
    .from("user_likes")
    .select("soundtrack_id")
    .eq("user_id", userId);

  const serverIds = new Set(
    (data ?? []).map((r: { soundtrack_id: string }) => r.soundtrack_id),
  );

  const localIds = loadFromLS();
  if (localIds.size > 0) {
    const rows = [...localIds].map((id) => ({
      user_id: userId,
      soundtrack_id: id,
    }));
    await supabase
      .from("user_likes")
      .upsert(rows, { onConflict: "user_id,soundtrack_id" });
    localStorage.removeItem(LS_KEY);
  }

  likedIds.value = new Set([...serverIds, ...localIds]);
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    if (
      (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
      session?.user
    ) {
      syncLikes(session.user.id);
    } else if (event === "SIGNED_OUT") {
      likedIds.value = loadFromLS();
    }
  });
}

export function useLikes() {
  function isLiked(id: string): boolean {
    return likedIds.value.has(id);
  }

  function toggleLike(id: string): 1 | -1 {
    const next = new Set(likedIds.value);
    const adding = !next.has(id);
    if (adding) next.add(id);
    else next.delete(id);
    likedIds.value = next;

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
        saveToLS(next);
      }
    });

    return adding ? 1 : -1;
  }

  return { isLiked, toggleLike };
}
