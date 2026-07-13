<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { useCollectionStore } from "@/stores/collections";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { useAuth } from "@/composables/useAuth";
import CreateCollectionModal from "@/components/CreateCollectionModal.vue";
import CoverCard from "@/components/CoverCard.vue";
import type { Collection, CollectionItem } from "@/types/collection";

const route = useRoute();
const router = useRouter();
const cStore = useCollectionStore();
const sStore = useSoundtrackStore();
const { user } = useAuth();

const collection = ref<Collection | null>(null);
const loading = ref(true);
const notFound = ref(false);
const copied = ref(false);
const showEdit = ref(false);

useHead(
  computed(() => ({
    title: collection.value
      ? `${collection.value.name} | SoundTrek`
      : "Collection | SoundTrek",
  })),
);

onMounted(async () => {
  const id = route.params.id as string;
  const data = await cStore.fetchCollection(id);
  loading.value = false;
  if (!data) {
    notFound.value = true;
    return;
  }
  collection.value = data;
});

const isOwner = computed(
  () =>
    !!user.value &&
    !!collection.value &&
    user.value.id === collection.value.user_id,
);

const items = computed<CollectionItem[]>(() =>
  [...(collection.value?.collection_items ?? [])].sort(
    (a, b) => a.position - b.position,
  ),
);

const tracks = computed(() =>
  items.value.map((i) => i.soundtrack).filter(Boolean),
);

const activeIndex = computed(() =>
  items.value.findIndex((i) => i.soundtrack_id === sStore.nowPlaying?.id),
);

function navigate(item: CollectionItem) {
  if (item.soundtrack)
    router.push(`/soundtrack/${item.soundtrack.slug ?? item.soundtrack.id}`);
}

function play(item: CollectionItem) {
  if (item.soundtrack) sStore.setNowPlaying(item.soundtrack);
}

async function copyLink() {
  await navigator.clipboard.writeText(window.location.href);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

async function deleteCollection() {
  if (!collection.value) return;
  if (!confirm(`Delete "${collection.value.name}"? This cannot be undone.`))
    return;
  await cStore.deleteCollection(collection.value.id);
  router.push("/collections");
}

function onUpdated() {
  showEdit.value = false;
  cStore.fetchCollection(route.params.id as string).then((d) => {
    if (d) collection.value = d;
  });
}
</script>

<template>
  <div class="page">
    <div v-if="loading" class="state">
      <div class="spinner" style="--spinner-size: 28px" />
    </div>

    <div v-else-if="notFound" class="state">
      <p class="empty">Collection not found or is private.</p>
    </div>

    <template v-else-if="collection">
      <button class="back-btn" @click="router.back()">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </button>

      <!-- Blurred backdrop -->
      <div
        class="backdrop"
        :style="
          tracks[0]?.cover_image_url
            ? `background-image: url('${tracks[0].cover_image_url}')`
            : ''
        "
      />

      <div class="hero">
        <div
          class="hero-cover"
          :class="{ 'hero-cover--mosaic': tracks.length >= 4 }"
        >
          <div v-if="tracks.length >= 4" class="cover-grid">
            <img
              v-for="(t, i) in tracks.slice(0, 4)"
              :key="i"
              :src="(t as any).cover_image_url ?? ''"
              :alt="(t as any).game_title"
            />
          </div>
          <img
            v-else-if="tracks[0]?.cover_image_url"
            :src="tracks[0].cover_image_url"
            :alt="(tracks[0] as any).game_title"
            class="cover-single"
          />
          <div v-else class="cover-empty">♫</div>
        </div>

        <div class="hero-info">
          <p class="hero-label">
            {{
              collection.is_public ? "Public Collection" : "Private Collection"
            }}
          </p>
          <h1 class="hero-title">{{ collection.name }}</h1>
          <p v-if="collection.description" class="hero-desc">
            {{ collection.description }}
          </p>
          <p class="hero-meta">
            By {{ collection.creator_name ?? "Unknown" }} ·
            {{ items.length }} track{{ items.length !== 1 ? "s" : "" }}
          </p>
          <div v-if="collection.theme_tags?.length" class="tags">
            <span v-for="t in collection.theme_tags" :key="t" class="tag">{{
              t
            }}</span>
          </div>

          <div class="hero-actions">
            <button
              class="btn-icon"
              :title="copied ? 'Copied!' : 'Copy link'"
              @click="copyLink"
            >
              {{ copied ? "✓" : "🔗" }}
            </button>
            <template v-if="isOwner">
              <button class="btn-icon" title="Edit" @click="showEdit = true">
                ✎
              </button>
              <button
                class="btn-icon btn-icon--danger"
                title="Delete"
                @click="deleteCollection"
              >
                🗑
              </button>
            </template>
          </div>
        </div>
      </div>

      <div class="separator" />

      <div v-if="items.length" class="track-grid">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          class="track-card"
          :class="{ active: activeIndex === index }"
        >
          <CoverCard
            v-if="item.soundtrack"
            :soundtrack="item.soundtrack"
            show-info
            @click="navigate(item)"
            @play="play(item)"
          />
        </div>
      </div>
      <p v-else class="empty">No tracks in this collection yet.</p>
    </template>
  </div>

  <CreateCollectionModal
    :open="showEdit"
    :editing="collection"
    @close="showEdit = false"
    @updated="onUpdated"
  />
</template>

<style scoped>
.page {
  flex: 1;
  position: relative;
  min-height: 90vh;
  background: var(--bg);
}

/* ── Blurred backdrop ─────────────────────────────────────────────────────── */
.backdrop {
  position: absolute;
  inset: 0;
  height: 480px;
  background-size: cover;
  background-position: center;
  filter: blur(80px) brightness(0.25) saturate(1.4);
  transform: scale(1);
  pointer-events: none;
}

.backdrop::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 50%, var(--bg) 100%);
}
.back-btn {
  position: absolute;
  top: 1.25rem;
  left: 1.5rem;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem 0.4rem 0.5rem;
  border: none;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.2);
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}
.back-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.state {
  display: flex;
  justify-content: center;
  padding: 4rem;
}
.empty {
  color: var(--text-muted);
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
}

/* Hero */
.hero {
  position: relative;
  padding: 4rem 3rem 3rem;
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  gap: 2rem;
  align-items: flex-end;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
}
.hero-cover {
  width: 240px;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface-2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
.hero-cover--mosaic {
  aspect-ratio: 1 / 1;
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
  aspect-ratio: 1 / 1;
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
  font-size: 3rem;
  color: var(--text-muted);
}
.hero-info {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.hero-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 0;
}
.hero-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.75rem, 5vw, 4rem);
  font-weight: 400;
  letter-spacing: 0.03em;
  margin: 0;
  line-height: 1;
}
.hero-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}
.hero-meta {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin: 0;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.tag {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-radius: 99px;
  padding: 0.2rem 0.65rem;
  font-size: 0.95rem;
}
.hero-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.5rem;
}
.btn-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}
.btn-icon:hover {
  border-color: var(--text-muted);
  color: var(--text-primary);
}
.btn-icon--danger:hover {
  border-color: #f87171;
  color: #f87171;
}

/* Separator */
.separator {
  position: relative;
  max-width: 1100px;
  margin: 0 auto 2.5rem;
  padding: 0 3rem;
}

.separator::after {
  content: "";
  display: block;
  height: 1px;
  background: var(--border);
}

/* Track grid */
.track-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 3rem 6rem;
}

.track-card {
  position: relative;
}

.track-card.active :deep(.cover-card) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 10px;
}

@media (max-width: 768px) {
  .back-btn {
    top: 1rem;
    left: 1rem;
    font-size: 0.9rem;
  }
  .hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 4rem 1rem 1.5rem;
    gap: 1.25rem;
    margin-bottom: 2rem;
  }
  .hero-cover {
    width: min(220px, 60vw);
    align-self: center;
  }
  .hero-info {
    width: 100%;
    min-width: 0;
  }
  .hero-title {
    font-size: 2.2rem;
    overflow-wrap: anywhere;
  }
  .separator {
    padding: 0 1rem;
    margin-bottom: 2rem;
  }
  .track-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    padding: 0 1rem 5rem;
  }
}
</style>
