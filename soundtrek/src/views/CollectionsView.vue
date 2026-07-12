<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { useCollectionStore } from "@/stores/collections";
import CreateCollectionModal from "@/components/CreateCollectionModal.vue";
import type { Collection } from "@/types/collection";

useHead({ title: "My Collections | SoundTrek" });

const router = useRouter();
const store = useCollectionStore();

const showCreate = ref(false);
const editing = ref<Collection | null>(null);

onMounted(() => store.fetchMyCollections());

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

async function deleteCollection(c: Collection) {
  if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
  await store.deleteCollection(c.id);
}
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <div class="page-header">
        <div>
          <h1 class="page-title">My Collections</h1>
          <p class="page-subtitle">
            {{ store.myCollections.length }} collection{{
              store.myCollections.length !== 1 ? "s" : ""
            }}
          </p>
        </div>
        <button class="btn-create" @click="showCreate = true">
          + New Collection
        </button>
      </div>

      <div v-if="store.loading" class="state">
        <div class="spinner" style="--spinner-size: 28px" />
      </div>

      <div v-else-if="!store.myCollections.length" class="empty">
        <p>You haven't created any collections yet.</p>
        <button class="btn-create" @click="showCreate = true">
          Create your first collection
        </button>
      </div>

      <div v-else class="grid">
        <div
          v-for="c in store.myCollections"
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

            <div class="card-overlay">
              <div class="overlay-top">
                <div v-if="c.theme_tags?.length" class="overlay-tags">
                  <span
                    v-for="t in c.theme_tags"
                    :key="t"
                    class="overlay-tag"
                    >{{ t }}</span
                  >
                </div>
              </div>
              <div class="overlay-actions" @click.stop>
                <button
                  class="overlay-btn"
                  @click="
                    editing = c;
                    showCreate = true;
                  "
                >
                  Edit
                </button>
                <button
                  class="overlay-btn overlay-btn--danger"
                  @click="deleteCollection(c)"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
          <div class="card-info">
            <p class="card-name">{{ c.name }}</p>
            <p class="card-meta">
              {{ itemCount(c) }} track{{ itemCount(c) !== 1 ? "s" : "" }} ·
              {{ c.is_public ? "Public" : "Private" }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <CreateCollectionModal
    :open="showCreate"
    :editing="editing"
    @close="
      showCreate = false;
      editing = null;
    "
    @created="showCreate = false"
    @updated="
      showCreate = false;
      editing = null;
    "
  />
</template>

<style scoped>
.page {
  flex: 1;
}
.page-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 2rem 4rem;
}
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 1rem;
}
.page-title {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
}
.page-subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0.25rem 0 0;
}
.btn-create {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 1.1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.state {
  display: flex;
  justify-content: center;
  padding: 4rem;
}
.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 4rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}

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
.card-meta {
  font-size: 1rem;
  color: var(--text-muted);
  margin: 0.2rem 0 0;
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
    rgba(0, 0, 0, 0.85) 0%,
    rgba(0, 0, 0, 0.4) 50%,
    rgba(0, 0, 0, 0) 100%
  );
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0.85rem;
  gap: 0.6rem;
  opacity: 0;
  transition: opacity 0.18s;
}
.card:hover .card-overlay {
  opacity: 1;
}

.overlay-top {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.overlay-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.overlay-meta {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.65);
  margin: 0;
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

.overlay-actions {
  display: flex;
  gap: 0.4rem;
}
.overlay-btn {
  flex: 1;
  padding: 0.35rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  transition: background 0.12s;
}
.overlay-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}
.overlay-btn--danger:hover {
  background: rgba(220, 38, 38, 0.6);
  border-color: transparent;
}
@media (max-width: 768px) {
  .page-inner {
    padding: 1.5rem 1rem 3rem;
  }
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
  }
}
</style>
