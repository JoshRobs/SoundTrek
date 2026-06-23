<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useHead } from "@unhead/vue";
import { useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { useComposerStore } from "@/stores/composers";
import { toSlug } from "@/utils/slug";
import PageHero from "@/components/PageHero.vue";
import SupportButton from "@/components/SupportButton.vue";

const route = useRoute();
const store = useSoundtrackStore();
const composerStore = useComposerStore();
const { allSoundtracks, loading, error } = storeToRefs(store);

const slug = computed(() => route.params.slug as string);

const profile = computed(() => composerStore.cache.get(slug.value) ?? null);

const composerSoundtracks = computed(() =>
  allSoundtracks.value.filter((s) =>
    (s.composers ?? []).some((c) => toSlug(c) === slug.value),
  ),
);

const composerName = computed(
  () =>
    profile.value?.name ??
    composerSoundtracks.value[0]?.composers?.find((c) => toSlug(c) === slug.value) ??
    slug.value.replace(/-/g, " "),
);

const subtitle = computed(
  () =>
    `${composerSoundtracks.value.length} ${composerSoundtracks.value.length === 1 ? "soundtrack" : "soundtracks"} in SoundTrek`,
);

onMounted(async () => {
  await Promise.all([store.loadAll(), composerStore.fetchComposer(slug.value)]);
});

useHead(computed(() => ({
  title: `${composerName.value} | SoundTrek`,
  meta: [
    { name: "description", content: `Listen to ${composerName.value}'s video game soundtracks on SoundTrek.` },
    { property: "og:title", content: `${composerName.value} | SoundTrek` },
    { property: "og:description", content: `Listen to ${composerName.value}'s video game soundtracks on SoundTrek.` },
    { property: "og:url", content: `https://soundtrek.app/composer/${slug.value}` },
  ],
})));
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
        <PageHero label="Composer" :title="composerName" :subtitle="subtitle" />

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
            :to="`/soundtrack/${s.id}`"
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

.bio {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 1.5rem;
  max-width: 680px;
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

.spinner {
  --spinner-size: 28px;
  width: var(--spinner-size);
  height: var(--spinner-size);
}
</style>
