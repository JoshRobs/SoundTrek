<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { useHead } from "@unhead/vue";
import { useRouter } from "vue-router";
import { supabase } from "@/lib/supabase";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { useInfiniteScroll } from "@/composables/useInfiniteScroll";
import PageHero from "@/components/PageHero.vue";
import CoverCard from "@/components/CoverCard.vue";
import type { Soundtrack } from "@/types/soundtrack";

const router = useRouter();
const { setNowPlaying } = useSoundtrackStore();

const PAGE_SIZE = 20;
const items = ref<Soundtrack[]>([]);
const error = ref<string | null>(null);
const sentinelEl = useTemplateRef<HTMLElement>("sentinel");

const { loadAll } = useSoundtrackStore();

function navigate(s: Soundtrack) {
  router.push(`/soundtrack/${s.slug ?? s.id}`);
}

useHead({
  title: "Top Soundtracks | SoundTrek",
  meta: [
    {
      name: "description",
      content:
        "The most popular video game soundtracks on SoundTrek, ranked by listener likes.",
    },
    { property: "og:title", content: "Top Soundtracks | SoundTrek" },
    {
      property: "og:description",
      content:
        "The most popular video game soundtracks on SoundTrek, ranked by listener likes.",
    },
    { property: "og:url", content: "https://soundtrek.app/top" },
  ],
});

const { loading, exhausted } = useInfiniteScroll(sentinelEl, async () => {
  const from = items.value.length;
  const { data, error: err } = await supabase
    .from("soundtracks")
    .select("*")
    .order("total_likes", { ascending: false })
    .order("created_at", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (err) {
    error.value = err.message;
    return false;
  }
  items.value.push(...(data ?? []));
  return (data?.length ?? 0) >= PAGE_SIZE;
});

loadAll();
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero
        label="Charts"
        title="Top Soundtracks"
        subtitle="Ranked by community likes"
      />

      <div v-if="error" class="error">{{ error }}</div>

      <div class="track-grid">
        <div v-for="(s, i) in items" :key="s.id" class="track-item">
          <span class="rank" :class="{ gold: i === 0, silver: i === 1, bronze: i === 2 }">
            {{ i + 1 }}
          </span>
          <CoverCard
            :soundtrack="s"
            show-info
            @click="navigate(s)"
            @play="setNowPlaying(s)"
          />
        </div>
      </div>

      <div ref="sentinel" class="sentinel">
        <div v-if="loading" class="loading">
          <div class="spinner" />
          <span>Loading more…</span>
        </div>
        <p v-else-if="exhausted && items.length > 0" class="end-note">
          You've seen all {{ items.length }} soundtracks
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
}

.page-inner {
  max-width: 1250px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 4rem;
}

.track-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2rem;
}

.track-item {
  position: relative;
}

.rank {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 1;
  font-size: 0.85rem;
  font-weight: 800;
  background: rgba(0,0,0,0.55);
  color: rgba(255,255,255,0.8);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
  backdrop-filter: blur(4px);
}

.rank.gold   { color: #f59e0b; }
.rank.silver { color: #94a3b8; }
.rank.bronze { color: #cd7f32; }

@media (max-width: 1024px) {
  .track-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 768px) {
  .page-inner { padding: 0 1rem 3rem; }
  .track-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
}

@media (max-width: 480px) {
  .track-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.sentinel {
  padding: 2rem 0;
  display: flex;
  justify-content: center;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.end-note {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.error {
  padding: 2rem;
  color: #f87171;
  font-size: 0.9rem;
}

.spinner {
  --spinner-size: 20px;
  width: var(--spinner-size);
  height: var(--spinner-size);
}
</style>
