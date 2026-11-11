<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { supabase } from "@/lib/supabase";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { toSlug } from "@/utils/slug";

const store = useSoundtrackStore();
const { allSoundtracks, loading } = storeToRefs(store);

// Slugs of composers-table rows that already have a bio — the same test the
// Composer Bios queue uses.
const slugsWithBio = ref<Set<string> | null>(null);
onMounted(async () => {
  const { data } = await supabase.from("composers").select("slug, bio");
  slugsWithBio.value = new Set(
    (data ?? []).filter((c) => c.bio).map((c) => c.slug as string),
  );
});

const ready = computed(() => !loading.value && allSoundtracks.value.length > 0);

const count = (pred: (s: (typeof allSoundtracks.value)[number]) => boolean) =>
  allSoundtracks.value.filter(pred).length;

const composerNames = computed(
  () => new Set(allSoundtracks.value.flatMap((s) => s.composers ?? [])),
);

const missingBios = computed(() => {
  const withBio = slugsWithBio.value;
  if (!withBio) return null;
  let n = 0;
  for (const name of composerNames.value) if (!withBio.has(toSlug(name))) n++;
  return n;
});

interface Task {
  label: string;
  hint: string;
  value: number | null;
  to: string;
}

// Each work queue in the admin, with how much is left in it.
const tasks = computed<Task[]>(() => [
  {
    label: "Missing composers",
    hint: "Soundtracks with no composer credited",
    value: count((s) => !(s.composers ?? []).length),
    to: "/admin/composers",
  },
  {
    label: "Composers without a bio",
    hint: "Credited composers with no bio saved",
    value: missingBios.value,
    to: "/admin/composer-bios",
  },
  {
    label: "Missing a buy link",
    hint: "No Amazon or no Loaded link",
    value: count((s) => !s.amazon_url || !s.loaded_url),
    to: "/admin/buy-links",
  },
  {
    label: "No YouTube source",
    hint: "Neither a playlist nor a full-OST video",
    value: count((s) => !s.youtube_video_id && !s.youtube_playlist_id),
    to: "/admin/links",
  },
  {
    label: "Missing slug",
    hint: "Served by ID instead of a readable URL",
    value: count((s) => !s.slug),
    to: "/admin/edit-soundtrack",
  },
]);

const totals = computed(() => [
  { label: "Soundtracks", value: allSoundtracks.value.length },
  { label: "Composers", value: composerNames.value.size },
  { label: "With YouTube", value: count((s) => !!(s.youtube_video_id || s.youtube_playlist_id)) },
  { label: "With Spotify", value: count((s) => !!s.spotify_id) },
]);

const fmt = (n: number | null) => (n === null || !ready.value ? "…" : n.toLocaleString());
</script>

<template>
  <div class="dashboard">
    <section>
      <h2 class="section-title">To do</h2>
      <div class="task-grid">
        <RouterLink
          v-for="t in tasks"
          :key="t.label"
          :to="t.to"
          class="task-card"
          :class="{ 'task-card--done': ready && t.value === 0 }"
        >
          <p class="stat-label">{{ t.label }}</p>
          <p class="stat-value">{{ ready && t.value === 0 ? "✓" : fmt(t.value) }}</p>
          <p class="task-hint">{{ t.hint }}</p>
          <span class="task-open">Open →</span>
        </RouterLink>
      </div>
    </section>

    <section>
      <h2 class="section-title">Catalog</h2>
      <div class="stat-grid">
        <div v-for="t in totals" :key="t.label" class="stat-card">
          <p class="stat-label">{{ t.label }}</p>
          <p class="stat-value">{{ fmt(t.value) }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin: 0 0 0.75rem;
}

.stat-grid,
.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.stat-card,
.task-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
}

.task-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;
}
.task-card:hover {
  border-color: var(--accent-light);
}
.task-card--done .stat-value {
  color: #4ade80;
}

.stat-label {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0 0 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.task-hint {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0.4rem 0 0.75rem;
  flex: 1;
}

.task-open {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent-light);
}
</style>
