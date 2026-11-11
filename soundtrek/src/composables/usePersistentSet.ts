import { ref, watch } from "vue";

// A reactive Set kept in this browser's localStorage, for per-admin queue
// conveniences like "skipped" items surviving a reload. Storage can be
// unavailable (private mode, SSG prerender), so every access is guarded and
// the set simply starts empty.
export function usePersistentSet(key: string) {
  const storageKey = `soundtrek-admin:${key}`;

  let initial: string[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(parsed)) initial = parsed.filter((v) => typeof v === "string");
  } catch {
    /* no storage — start empty */
  }

  const set = ref(new Set<string>(initial));

  watch(
    set,
    (s) => {
      try {
        if (s.size) localStorage.setItem(storageKey, JSON.stringify([...s]));
        else localStorage.removeItem(storageKey);
      } catch {
        /* no storage — keep it in memory only */
      }
    },
    { deep: true },
  );

  function clear() {
    set.value = new Set();
  }

  return { set, clear };
}
