import { ref, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { supabase } from "@/lib/supabase";
import { usePlayerStore } from "@/stores/player";
import type { Soundtrack, FilterState, ExploreRow } from "@/types/soundtrack";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const useSoundtrackStore = defineStore("soundtracks", () => {
  // ── Catalog ────────────────────────────────────────────────────────────────
  const allSoundtracks = ref<Soundtrack[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let fetched = false;

  // Tracks whether the current rows came straight from Supabase. Admin pages
  // require fresh rows (the edit form hydrates from them), so a cached load
  // must be replaced when they ask.
  let fetchedFresh = false;

  async function loadAll(opts?: { fresh?: boolean }) {
    const wantFresh = !!opts?.fresh;
    if (fetched && (fetchedFresh || !wantFresh)) return;
    loading.value = true;
    error.value = null;

    try {
      let all: Soundtrack[] | null = null;
      let viaCache = false;

      // Cached catalog from the Cloudflare worker — spares Supabase the
      // ~2MB-per-visitor egress. Stale by up to the worker's TTL, which is
      // fine everywhere except admin editing.
      const proxyUrl = import.meta.env.VITE_YOUTUBE_PROXY_URL;
      if (!wantFresh && proxyUrl) {
        try {
          const res = await fetch(`${proxyUrl}/catalog`);
          if (res.ok) {
            all = (await res.json()) as Soundtrack[];
            viaCache = true;
          }
        } catch {
          /* worker unreachable — fall back to Supabase below */
        }
      }

      if (!all) {
        const PAGE = 1000;
        all = [];
        let from = 0;
        while (true) {
          const { data, error: err } = await supabase
            .from("soundtracks")
            .select("*")
            .order("created_at", { ascending: true })
            .range(from, from + PAGE - 1);
          if (err) throw err;
          all = all.concat(data ?? []);
          if (!data || data.length < PAGE) break;
          from += PAGE;
        }
      }

      allSoundtracks.value = all;
      fetched = true;
      fetchedFresh = !viaCache;
    } catch (e: unknown) {
      error.value =
        e instanceof Error ? e.message : "Failed to load soundtracks.";
    } finally {
      loading.value = false;
    }
  }

  // ── Now playing ───────────────────────────────────────────────────────────
  // Derived from the player queue (see stores/player.ts) — the current queue
  // item's soundtrack, or the one playback started from. Kept here so the
  // many existing consumers don't have to change stores.
  const player = usePlayerStore();
  const nowPlaying = computed(() => player.nowPlaying);

  function setNowPlaying(s: Soundtrack | null) {
    player.playSoundtrack(s);
  }

  // ── Discovery state ────────────────────────────────────────────────────────
  const currentSoundtrack = ref<Soundtrack | null>(null);
  const filters = ref<FilterState>({
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

  const topComposers = computed(() => {
    const counts = new Map<string, number>();
    allSoundtracks.value.forEach((s) =>
      (s.composers ?? []).forEach((c) => {
        if (c === "Various Artists") return;
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }),
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
    buildRows("theme", 5, (s) => s.theme_tags ?? []);
    buildRows("console", 4, (s) => [s.console]);

    return rows;
  });

  // ── Filter options ─────────────────────────────────────────────────────────
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
    filters.value = { genres: [], themes: [], consoles: [] };
  }

  // Returns the authoritative new `likes` count (raw column value, before
  // rating_count is added by displayLikes), so callers rendering a row that
  // isn't in allSoundtracks (e.g. SoundtrackView's own fetch) can reconcile it.
  async function likeSoundtrack(
    id: string,
    delta: 1 | -1,
  ): Promise<number | undefined> {
    // The catalog is loaded lazily (views fetch their own rows), so the
    // store row may be absent — the counter RPC must fire regardless; only
    // the optimistic bump needs the row.
    const track = allSoundtracks.value.find((s) => s.id === id);
    if (track) track.likes += delta; // optimistic
    if (!USE_MOCK) {
      const { data, error } = await supabase.rpc("toggle_soundtrack_like", {
        p_soundtrack_id: id,
        p_delta: delta,
      });
      // Reconcile with the authoritative server value — the RPC dedupes
      // repeat likes/unlikes server-side, so it can differ from the
      // optimistic guess above (e.g. a stale double-click no-ops there).
      if (!error && typeof data === "number") {
        if (track) track.likes = data;
        return data;
      }
      return undefined;
    }
    return track?.likes;
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
    topComposers,
    topStudios,
    // Filter options
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

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSoundtrackStore, import.meta.hot));
}
