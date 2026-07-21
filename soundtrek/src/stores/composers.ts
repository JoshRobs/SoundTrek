import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { supabase } from "@/lib/supabase";
import type { Composer } from "@/types/soundtrack";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === "true";

export const useComposerStore = defineStore("composers", () => {
  const cache = ref(new Map<string, Composer | null>());
  const fetching = new Set<string>();

  async function fetchComposer(slug: string): Promise<Composer | null> {
    if (cache.value.has(slug)) return cache.value.get(slug) ?? null;
    if (fetching.has(slug)) return null;

    if (USE_MOCK) {
      cache.value.set(slug, null);
      return null;
    }

    fetching.add(slug);
    try {
      const { data } = await supabase
        .from("composers")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      cache.value.set(slug, data ?? null);
      return data ?? null;
    } finally {
      fetching.delete(slug);
    }
  }

  async function fetchMany(slugs: string[]): Promise<void> {
    const uncached = [...new Set(slugs)].filter(
      (s) => !cache.value.has(s) && !fetching.has(s),
    );
    if (uncached.length === 0 || USE_MOCK) return;

    uncached.forEach((s) => fetching.add(s));
    try {
      const { data } = await supabase
        .from("composers")
        .select("*")
        .in("slug", uncached);
      const bySlug = new Map((data ?? []).map((c) => [c.slug, c]));
      for (const slug of uncached) cache.value.set(slug, bySlug.get(slug) ?? null);
    } finally {
      uncached.forEach((s) => fetching.delete(s));
    }
  }

  return { cache, fetchComposer, fetchMany };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useComposerStore, import.meta.hot));
}
