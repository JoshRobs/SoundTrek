import { ref } from "vue";

const LS_KEY = "soundtrek:liked";

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function save(ids: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
}

// Module-level reactive state so all component instances share the same set.
const likedIds = ref<Set<string>>(load());

export function useLikes() {
  function isLiked(id: string): boolean {
    return likedIds.value.has(id);
  }

  function toggleLike(id: string): 1 | -1 {
    const next = new Set(likedIds.value);
    if (next.has(id)) {
      next.delete(id);
      likedIds.value = next;
      save(next);
      return -1;
    } else {
      next.add(id);
      likedIds.value = next;
      save(next);
      return 1;
    }
  }

  return { isLiked, toggleLike };
}
