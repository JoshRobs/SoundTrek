<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { useCollectionStore } from "@/stores/collections";
import PageHero from "@/components/PageHero.vue";
import type { Collection } from "@/types/collection";

useHead({
  title: "Browse Collections | SoundTrek",
  meta: [
    {
      name: "description",
      content: "Browse soundtrack collections curated by the SoundTrek community.",
    },
  ],
});

const router = useRouter();
const store = useCollectionStore();

onMounted(() => store.fetchPublicCollections());

type SortKey = "newest" | "tracks" | "name";
const sortBy = ref<SortKey>("newest");

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "tracks", label: "Most Tracks" },
  { value: "name",   label: "Name A–Z" },
];

const sortedCollections = computed(() => {
  const list = [...store.publicCollections];
  switch (sortBy.value) {
    case "newest":
      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case "tracks":
      return list.sort((a, b) => itemCount(b) - itemCount(a));
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
  }
});

function coverImages(c: Collection): string[] {
  const items = (c.collection_items as any[]) ?? [];
  return items
    .map((i: any) => i.soundtrack?.cover_image_url)
    .filter(Boolean)
    .slice(0, 4);
}

function itemCount(c: Collection): number {
  return (c.collection_items as any[])?.length ?? 0;
}
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero
        label="Community"
        title="Browse Collections"
        subtitle="Soundtrack collections curated by other listeners"
      />

      <div v-if="sortedCollections.length" class="sort-bar">
        <button
          v-for="opt in sortOptions"
          :key="opt.value"
          class="sort-pill"
          :class="{ active: sortBy === opt.value }"
          @click="sortBy = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <div v-if="store.loadingPublic" class="state">
        <div class="spinner" style="--spinner-size: 28px" />
      </div>

      <div v-else-if="sortedCollections.length" class="grid">
        <div
          v-for="c in sortedCollections"
          :key="c.id"
          class="card"
          @click="router.push(`/collection/${c.id}`)"
        >
          <div class="card-cover">
            <div v-if="coverImages(c).length === 4" class="cover-grid">
              <img
                v-for="(src, i) in coverImages(c)"
                :key="i"
                :src="src"
                :alt="c.name"
              />
            </div>
            <img
              v-else-if="coverImages(c).length"
              :src="coverImages(c)[0]"
              :alt="c.name"
              class="cover-single"
            />
            <div v-else class="cover-empty">♫</div>

            <div v-if="c.theme_tags?.length" class="card-overlay">
              <div class="overlay-tags">
                <span v-for="t in c.theme_tags" :key="t" class="overlay-tag">{{
                  t
                }}</span>
              </div>
            </div>
          </div>
          <div class="card-info">
            <p class="card-name">{{ c.name }}</p>
            <p class="card-creator">by {{ c.creator_name ?? "Anonymous" }}</p>
            <p class="card-meta">
              {{ itemCount(c) }} track{{ itemCount(c) !== 1 ? "s" : "" }}
            </p>
          </div>
        </div>
      </div>

      <div v-else class="empty">
        <p>No public collections yet.</p>
        <p class="empty-sub">
          Be the first — create a collection and make it public.
        </p>
        <RouterLink to="/collections" class="browse-link"
          >My Collections</RouterLink
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
}

.page-inner {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 4rem;
}

/* ── Sort bar ─────────────────────────────────────────────────────────────── */
.sort-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.sort-pill {
  padding: 0.35rem 0.85rem;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.sort-pill:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.sort-pill.active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  color: var(--accent-light, var(--accent));
}

/* ── States ───────────────────────────────────────────────────────────────── */
.state {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

.empty {
  padding: 4rem 0;
  text-align: center;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.empty p {
  margin: 0;
  font-size: 0.95rem;
}

.empty-sub {
  font-size: 0.85rem !important;
}

.browse-link {
  margin-top: 1rem;
  display: inline-block;
  padding: 0.55rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-decoration: none;
  transition:
    background 0.15s,
    color 0.15s;
}

.browse-link:hover {
  background: var(--surface-3, var(--surface-2));
  color: var(--text-primary);
}

/* ── Grid ─────────────────────────────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
.card {
  border-radius: 12px;
  cursor: pointer;
  transition:
    transform 0.18s,
    box-shadow 0.18s;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
}

.card-cover {
  position: relative;
  aspect-ratio: 1;
  background: var(--surface-2);
  overflow: hidden;
  border-radius: 12px;
}

.cover-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  height: 100%;
}

.cover-grid img {
  width: 100%;
  height: 100%;
  aspect-ratio: 1/1;
  object-fit: cover;
}

.cover-single {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  color: var(--text-muted);
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.75) 0%,
    rgba(0, 0, 0, 0.25) 45%,
    rgba(0, 0, 0, 0) 100%
  );
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0.85rem;
  opacity: 0;
  transition: opacity 0.18s;
}

.card:hover .card-overlay {
  opacity: 1;
}

.overlay-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.overlay-tag {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 99px;
  padding: 0.1rem 0.45rem;
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.8);
}

.card-info {
  padding: 0 0.1rem;
}

.card-name {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-creator {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0.2rem 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0.15rem 0 0;
}

@media (max-width: 768px) {
  .page-inner {
    padding: 0 1rem 5rem;
  }

  .sort-bar {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 0.25rem;
    margin-bottom: 1.25rem;
    -webkit-overflow-scrolling: touch;
  }

  .sort-bar::-webkit-scrollbar {
    display: none;
  }

  .sort-pill {
    flex-shrink: 0;
  }

  .grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
  }

  .card-name {
    font-size: 1.05rem;
  }

  .card-creator,
  .card-meta {
    font-size: 0.8rem;
  }
}

/* Always show tag overlay on touch devices */
@media (hover: none) {
  .card-overlay {
    opacity: 1;
  }
}
</style>
