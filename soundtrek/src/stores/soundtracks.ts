import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { supabase } from "@/lib/supabase";
import { mockSoundtracks } from "@/data/mockSoundtracks";
import type { Soundtrack, FilterState, ExploreRow } from "@/types/soundtrack";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const useSoundtrackStore = defineStore("soundtracks", () => {
  // ── Catalog ────────────────────────────────────────────────────────────────
  const allSoundtracks = ref<Soundtrack[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let fetched = false;

  async function loadAll() {
    if (fetched) return;
    loading.value = true;
    error.value = null;

    if (USE_MOCK) {
      allSoundtracks.value = mockSoundtracks;
      fetched = true;
      loading.value = false;
      return;
    }

    try {
      const { data, error: err } = await supabase
        .from("soundtracks")
        .select("*")
        .order("created_at", { ascending: true });
      if (err) throw err;
      allSoundtracks.value = data ?? [];
      fetched = true;
    } catch (e: unknown) {
      error.value =
        e instanceof Error ? e.message : "Failed to load soundtracks.";
    } finally {
      loading.value = false;
    }
  }

  // ── Now playing ───────────────────────────────────────────────────────────
  const nowPlaying = ref<Soundtrack | null>(null);
  function setNowPlaying(s: Soundtrack | null) {
    nowPlaying.value = s;
  }

  // ── Discovery state ────────────────────────────────────────────────────────
  const currentSoundtrack = ref<Soundtrack | null>(null);
  const filters = ref<FilterState>({
    moods: [],
    genres: [],
    themes: [],
    consoles: [],
  });
  const seenIds = ref(new Set<string>());

  // ── Explore menu data ─────────────────────────────────────────────────────
  const featuredSoundtracks = computed(() => {
    const pool = allSoundtracks.value;
    if (pool.length <= 5) return pool;
    return [...pool].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 5);
  });

  const topGenres = computed(() => {
    const counts = new Map<string, number>();
    allSoundtracks.value.forEach((s) =>
      (s.genre_tags ?? []).forEach((g) =>
        counts.set(g, (counts.get(g) ?? 0) + 1),
      ),
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([g]) => g);
  });

  const topThemes = computed(() => {
    const counts = new Map<string, number>();
    allSoundtracks.value.forEach((s) =>
      (s.theme_tags ?? []).forEach((t) =>
        counts.set(t, (counts.get(t) ?? 0) + 1),
      ),
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t]) => t);
  });

  const topMoods = computed(() => {
    const counts = new Map<string, number>();
    allSoundtracks.value.forEach((s) =>
      (s.mood_tags ?? []).forEach((m) =>
        counts.set(m, (counts.get(m) ?? 0) + 1),
      ),
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([m]) => m);
  });

  const topComposers = computed(() => {
    const counts = new Map<string, number>();
    allSoundtracks.value.forEach((s) =>
      (s.composers ?? []).forEach((c) =>
        counts.set(c, (counts.get(c) ?? 0) + 1),
      ),
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  });

  const topStudios = computed(() => {
    const counts = new Map<string, number>();
    allSoundtracks.value.forEach((s) =>
      counts.set(s.studio, (counts.get(s.studio) ?? 0) + 1),
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  });

  // ── Explore rows ───────────────────────────────────────────────────────────
  const exploreRows = computed((): ExploreRow[] => {
    const rows: ExploreRow[] = [];

    function buildRows(
      type: string,
      maxRows: number,
      getKeys: (s: Soundtrack) => string[],
    ) {
      const map = new Map<string, Soundtrack[]>();
      allSoundtracks.value.forEach((s) =>
        getKeys(s).forEach((key) => {
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(s);
        }),
      );
      [...map.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .filter(([, items]) => items.length >= 2)
        .slice(0, maxRows)
        .forEach(([label, items]) =>
          rows.push({
            type,
            label,
            items: [...items].sort(() => Math.random() - 0.5).slice(0, 15),
          }),
        );
    }

    buildRows("genre", 6, (s) => s.genre_tags ?? []);
    buildRows("mood", 5, (s) => s.mood_tags ?? []);
    buildRows("theme", 5, (s) => s.theme_tags ?? []);
    buildRows("console", 4, (s) => [s.console]);

    return rows;
  });

  // ── Filter options ─────────────────────────────────────────────────────────
  const availableMoods = computed(() => {
    const set = new Set<string>();
    allSoundtracks.value.forEach((s) =>
      (s.mood_tags ?? []).forEach((t) => set.add(t)),
    );
    return [...set].sort();
  });

  const availableGenres = computed(() => {
    const set = new Set<string>();
    allSoundtracks.value.forEach((s) =>
      (s.genre_tags ?? []).forEach((t) => set.add(t)),
    );
    return [...set].sort();
  });

  const availableThemes = computed(() => {
    const set = new Set<string>();
    allSoundtracks.value.forEach((s) =>
      (s.theme_tags ?? []).forEach((t) => set.add(t)),
    );
    return [...set].sort();
  });

  const availableConsoles = computed(() => {
    const set = new Set<string>();
    allSoundtracks.value.forEach((s) => set.add(s.console));
    return [...set].sort();
  });

  // ── Derived pool ───────────────────────────────────────────────────────────
  const filteredPool = computed(() =>
    allSoundtracks.value.filter((s) => {
      if (
        filters.value.moods.length &&
        !(s.mood_tags ?? []).some((t) => filters.value.moods.includes(t))
      )
        return false;
      if (
        filters.value.genres.length &&
        !(s.genre_tags ?? []).some((t) => filters.value.genres.includes(t))
      )
        return false;
      if (
        filters.value.themes.length &&
        !(s.theme_tags ?? []).some((t) => filters.value.themes.includes(t))
      )
        return false;
      if (
        filters.value.consoles.length &&
        !filters.value.consoles.includes(s.console)
      )
        return false;
      return true;
    }),
  );

  const poolExhausted = computed(() =>
    filteredPool.value.every((s) => seenIds.value.has(s.id)),
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  function pickNext() {
    let pool = filteredPool.value.filter((s) => !seenIds.value.has(s.id));
    if (pool.length === 0) {
      seenIds.value = new Set();
      pool = filteredPool.value;
    }
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    seenIds.value.add(pick.id);
    currentSoundtrack.value = pick;
  }

  async function fetchSoundtracks() {
    await loadAll();
    if (!error.value && !currentSoundtrack.value) pickNext();
  }

  function resetFilters() {
    filters.value = { moods: [], genres: [], themes: [], consoles: [] };
  }

  async function likeSoundtrack(id: string, delta: 1 | -1) {
    const track = allSoundtracks.value.find((s) => s.id === id);
    if (!track) return;
    track.likes += delta;
    if (!USE_MOCK) {
      await supabase
        .from("soundtracks")
        .update({ likes: track.likes })
        .eq("id", id);
    }
  }

  return {
    // Catalog
    allSoundtracks,
    loading,
    error,
    loadAll,
    // Now playing
    nowPlaying,
    setNowPlaying,
    // Explore
    exploreRows,
    featuredSoundtracks,
    topGenres,
    topThemes,
    topMoods,
    topComposers,
    topStudios,
    // Filter options
    availableMoods,
    availableGenres,
    availableThemes,
    availableConsoles,
    // Discovery
    currentSoundtrack,
    filters,
    filteredPool,
    poolExhausted,
    fetchSoundtracks,
    nextSoundtrack: pickNext,
    resetFilters,
    likeSoundtrack,
  };
});
