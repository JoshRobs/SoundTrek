import { ref } from "vue";
import { defineStore } from "pinia";
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

  return { cache, fetchComposer };
});
