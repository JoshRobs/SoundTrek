<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useHead } from "@unhead/vue";
import { useRoute } from "vue-router";
import { supabase, SOUNDTRACK_LIST_COLUMNS } from "@/lib/supabase";
import { useComposerStore } from "@/stores/composers";
import { toSlug } from "@/utils/slug";
import PageHero from "@/components/PageHero.vue";
import SupportButton from "@/components/SupportButton.vue";
import type { Soundtrack } from "@/types/soundtrack";

const route = useRoute();
const composerStore = useComposerStore();

const slug = computed(() => route.params.slug as string);

const profile = computed(() => composerStore.cache.get(slug.value) ?? null);
const imageUrl = computed(() => profile.value?.image_url ?? null);
const imgBroken = ref(false);
watch(imageUrl, () => (imgBroken.value = false));

// Click the avatar to view it enlarged in a lightbox.
const lightboxOpen = ref(false);
function openLightbox() {
  if (imageUrl.value && !imgBroken.value) lightboxOpen.value = true;
}
function closeLightbox() {
  lightboxOpen.value = false;
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") closeLightbox();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

const composerSoundtracks = ref<Soundtrack[]>([]);
const composerNameFallback = ref("");
const loading = ref(true);
const error = ref<string | null>(null);

watch(
  slug,
  async (currentSlug) => {
    loading.value = true;
    error.value = null;

    const profileResult = await composerStore.fetchComposer(currentSlug);

    let name = profileResult?.name ?? null;
    if (!name) {
      // No composer profile row — fall back to resolving the slug against
      // just the `composers` column across the table (still far smaller
      // than a full soundtrack row per track). PostgREST caps an unbounded
      // select at 1000 rows, so this has to page through everything —
      // otherwise composers only credited on later rows silently vanish.
      const PAGE_SIZE = 1000;
      let from = 0;
      while (!name) {
        const { data: composerRows, error: err } = await supabase
          .from("soundtracks")
          .select("composers")
          .range(from, from + PAGE_SIZE - 1)
          .returns<Pick<Soundtrack, "composers">[]>();
        if (err) {
          error.value = err.message;
          loading.value = false;
          return;
        }
        if (!composerRows || composerRows.length === 0) break;
        for (const row of composerRows) {
          const match = (row.composers ?? []).find(
            (c: string) => toSlug(c) === currentSlug,
          );
          if (match) {
            name = match;
            break;
          }
        }
        if (composerRows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    }
    composerNameFallback.value = name ?? currentSlug.replace(/-/g, " ");

    if (!name) {
      composerSoundtracks.value = [];
      loading.value = false;
      return;
    }

    const { data, error: err2 } = await supabase
      .from("soundtracks")
      .select(SOUNDTRACK_LIST_COLUMNS)
      .contains("composers", [name])
      .order("total_likes", { ascending: false });
    if (err2) {
      error.value = err2.message;
    } else {
      composerSoundtracks.value = (data ?? []) as Soundtrack[];
    }
    loading.value = false;
  },
  { immediate: true },
);

const composerName = computed(
  () => profile.value?.name ?? composerNameFallback.value,
);

const subtitle = computed(
  () =>
    `${composerSoundtracks.value.length} ${composerSoundtracks.value.length === 1 ? "soundtrack" : "soundtracks"} in SoundTrek`,
);

useHead(
  computed(() => ({
    title: `${composerName.value} | SoundTrek`,
    meta: [
      {
        name: "description",
        content: `Listen to ${composerName.value}'s video game soundtracks on SoundTrek.`,
      },
      { property: "og:title", content: `${composerName.value} | SoundTrek` },
      {
        property: "og:description",
        content: `Listen to ${composerName.value}'s video game soundtracks on SoundTrek.`,
      },
      {
        property: "og:url",
        content: `https://soundtrek.app/composer/${slug.value}`,
      },
    ],
  })),
);
</script>

<template>
  <div class="page">
    <div v-if="loading" class="state">
      <div class="spinner" />
      <p>Loading…</p>
    </div>

    <div v-else-if="error" class="state error">
      <p>{{ error }}</p>
    </div>

    <template v-else>
      <div class="page-inner">
        <div class="composer-header">
          <button
            v-if="imageUrl && !imgBroken"
            type="button"
            class="composer-avatar"
            aria-label="View larger profile picture"
            @click="openLightbox"
          >
            <img
              :src="imageUrl"
              :alt="composerName"
              referrerpolicy="no-referrer"
              @error="imgBroken = true"
            />
          </button>
          <PageHero
            label="Composer"
            :title="composerName"
            :subtitle="subtitle"
          />
        </div>

        <div v-if="profile?.bio" class="bio">{{ profile.bio }}</div>

        <SupportButton :composer-name="composerName" />

        <div v-if="composerSoundtracks.length === 0" class="state">
          <p>No soundtracks found for this composer.</p>
          <RouterLink to="/" class="home-link">Back to discovery</RouterLink>
        </div>

        <section v-else class="grid">
          <RouterLink
            v-for="s in composerSoundtracks"
            :key="s.id"
            :to="`/soundtrack/${s.slug ?? s.id}`"
            class="grid-card"
          >
            <div class="grid-cover">
              <img
                v-if="s.cover_image_url"
                :src="s.cover_image_url"
                :alt="s.game_title"
                class="grid-img"
              />
              <div v-else class="grid-fallback">🎮</div>
            </div>
            <div class="grid-info">
              <p class="grid-title">{{ s.game_title }}</p>
              <p class="grid-year">{{ s.release_year }}</p>
            </div>
          </RouterLink>
        </section>
      </div>
    </template>

    <Teleport to="body">
      <Transition name="lightbox-fade">
        <div
          v-if="lightboxOpen && imageUrl"
          class="lightbox"
          @click="closeLightbox"
        >
          <button
            type="button"
            class="lightbox-close"
            aria-label="Close"
            @click="closeLightbox"
          >
            ✕
          </button>
          <img
            :src="imageUrl"
            :alt="composerName"
            class="lightbox-img"
            referrerpolicy="no-referrer"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.page-inner {
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
}

@media (max-width: 768px) {
  .page-inner {
    padding: 0 1rem 3rem;
  }
}

.composer-header {
  margin-top: 20px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.composer-avatar {
  flex-shrink: 0;
  width: 200px;
  height: 200px;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
  background: var(--surface-2);
  border: 2px solid var(--border);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.composer-avatar:hover {
  border-color: #77777770;
  box-shadow: 0 0 20px color-mix(in srgb, white 15%, transparent);
}

.composer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}

.composer-avatar:hover img {
  transform: scale(1.05);
}

/* Enlarged profile-picture lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 2rem;
  cursor: zoom-out;
}

.lightbox-img {
  max-width: min(90vw, 560px);
  max-height: 90vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 10px 60px rgba(0, 0, 0, 0.6);
}

.lightbox-close {
  position: fixed;
  top: 1.25rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: #fff;
  font-size: 1.75rem;
  line-height: 1;
  padding: 0.25rem;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.15s;
}

.lightbox-close:hover {
  opacity: 1;
}

.lightbox-fade-enter-active,
.lightbox-fade-leave-active {
  transition: opacity 0.18s ease;
}

.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}

.bio {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 1.5rem;
  max-width: 680px;
}

@media (max-width: 768px) {
  .composer-header {
    gap: 1rem;
  }

  .composer-avatar {
    width: 84px;
    height: 84px;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}

.grid-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  cursor: pointer;
  text-decoration: none;
}

.grid-cover {
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-2);
}

.grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.grid-card:hover .grid-img {
  transform: scale(1.03);
}

.grid-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--text-muted);
}

.grid-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.grid-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.grid-year {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 3rem;
}

.state.error {
  color: #f87171;
}
.state p {
  margin: 0;
}

.home-link {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.875rem;
}
.home-link:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .grid-title {
    font-size: 0.82rem;
  }

  .grid-year {
    font-size: 0.7rem;
  }
}

.spinner {
  --spinner-size: 28px;
  width: var(--spinner-size);
  height: var(--spinner-size);
}
</style>
