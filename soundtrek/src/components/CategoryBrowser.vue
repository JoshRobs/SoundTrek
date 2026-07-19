<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { toSlug } from "@/utils/slug";

const router = useRouter();
const store = useSoundtrackStore();
const { allSoundtracks } = storeToRefs(store);

// Self-sufficient: the landing page no longer loads the catalog itself, so
// fetch it here (worker KV-cached, deduped by the store). The cards pop in
// reactively when it resolves.
store.loadAll();

const CATEGORIES = [
  { label: "historical", type: "theme", tags: ["historical"] },
  {
    label: "Sci-Fi",
    type: "theme",
    slug: "science-fiction",
    tags: ["sci-fi", "science fiction", "sci fi"],
  },
  { label: "Fantasy", type: "theme", tags: ["fantasy"] },
  { label: "Indie", type: "genre", tags: ["indie"] },
  { label: "Adventure", type: "genre", tags: ["adventurous", "adventure"] },
] as const;

const cards = computed(() =>
  CATEGORIES.map((cat) => {
    const matches = allSoundtracks.value.filter((s) => {
      const all = [...(s.genre_tags ?? []), ...(s.theme_tags ?? [])].map((t) =>
        t.toLowerCase(),
      );
      return cat.tags.some((tag) => all.includes(tag));
    });
    const withCover = matches.filter((s) => s.cover_image_url);
    const pick =
      withCover[Math.floor(Math.random() * withCover.length)] ?? null;
    return {
      label: cat.label,
      type: cat.type,
      slug: "slug" in cat ? cat.slug : toSlug(cat.label),
      cover: pick?.cover_image_url ?? null,
    };
  }),
);

function navigate(type: string, slug: string) {
  router.push(`/category/${type}/${slug}`);
}
</script>

<template>
  <div v-if="cards.some((c) => c.cover)" class="category-browser">
    <button
      v-for="card in cards"
      :key="card.slug"
      class="cat-card"
      @click="navigate(card.type, card.slug)"
    >
      <img
        v-if="card.cover"
        :src="card.cover"
        :alt="card.label"
        class="cat-img"
      />
      <div class="cat-overlay" />
      <span class="cat-label">{{ card.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.category-browser {
  display: flex;
  gap: 0.75rem;
  padding: 2rem 2.5rem;
  max-width: 1300px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.cat-card {
  position: relative;
  flex: 1;
  aspect-ratio: 3 / 2;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: none;
  padding: 0;
  background: var(--surface-2);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.cat-card:hover {
  transform: scale(1.03);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 1;
}

.cat-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
}

.cat-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.85) 0%,
    rgba(0, 0, 0, 0.3) 50%,
    rgba(0, 0, 0, 0.1) 100%
  );
}

.cat-label {
  position: absolute;
  bottom: 25%;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

@media (max-width: 768px) {
  .category-browser {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 1.25rem 1rem;
    gap: 0.6rem;
  }

  /* First card spans full width as a feature banner */
  .cat-card:first-child {
    grid-column: span 2;
    aspect-ratio: 5 / 2;
  }

  .cat-label {
    font-size: 1.1rem;
    letter-spacing: 0.1em;
  }

  .cat-card:first-child .cat-label {
    font-size: 1.4rem;
  }

  /* Disable hover scale on touch — it sticks */
  .cat-card:hover {
    transform: none;
    box-shadow: none;
  }
}
</style>
