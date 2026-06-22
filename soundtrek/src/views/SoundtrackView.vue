<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useHead } from "@unhead/vue";
import { useSoundtrackStore } from "@/stores/soundtracks";
import StreamingLinks from "@/components/StreamingLinks.vue";
import { toSlug } from "@/utils/slug";

const route = useRoute();
const router = useRouter();
const store = useSoundtrackStore();
const { allSoundtracks } = storeToRefs(store);

const id = route.params.id as string;
const notFound = ref(false);
const liked = ref(false);
const coverColor = ref("");

const track = computed(
  () => allSoundtracks.value.find((s) => s.id === id) ?? null,
);

useHead(computed(() => {
  const t = track.value
  const title = t ? `${t.game_title} OST | SoundTrek` : 'SoundTrek'
  const description = t
    ? `Listen to the ${t.game_title} soundtrack by ${t.composer} (${t.release_year}) on SoundTrek.`
    : ''
  const pageUrl = `https://soundtrek.app/soundtrack/${id}`
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:type', content: 'music.album' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: pageUrl },
      { property: 'og:image', content: t?.cover_image_url ?? '' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: t?.cover_image_url ?? '' },
    ],
    script: t ? [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'MusicAlbum',
        name: `${t.game_title} OST`,
        byArtist: { '@type': 'Person', name: t.composer },
        datePublished: String(t.release_year),
        image: t.cover_image_url,
        url: pageUrl,
      }),
    }] : [],
  }
}))

const moreFromComposer = computed(() => {
  if (!track.value) return [];
  return allSoundtracks.value
    .filter((s) => s.composer === track.value!.composer && s.id !== id)
    .slice(0, 12);
});

const similarSoundtracks = computed(() => {
  if (!track.value) return [];
  const genres = new Set(track.value.genre_tags ?? []);
  const moods = new Set(track.value.mood_tags ?? []);
  return allSoundtracks.value
    .filter((s) => s.id !== id && s.composer !== track.value!.composer)
    .map((s) => ({
      s,
      score:
        (s.genre_tags ?? []).filter((t) => genres.has(t)).length * 2 +
        (s.mood_tags ?? []).filter((t) => moods.has(t)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ s }) => s);
});

// ── Scroll nav ────────────────────────────────────────────────────────────────
function useScrollRow() {
  const el = ref<HTMLElement | null>(null);
  const canLeft = ref(false);
  const canRight = ref(true);

  function update() {
    if (!el.value) return;
    canLeft.value = el.value.scrollLeft > 0;
    canRight.value =
      el.value.scrollLeft + el.value.clientWidth < el.value.scrollWidth - 1;
  }

  function scroll(dir: number) {
    el.value?.scrollBy({ left: dir * 540, behavior: "smooth" });
  }

  function attach() {
    el.value?.addEventListener("scroll", update, { passive: true });
    update();
  }
  function detach() {
    el.value?.removeEventListener("scroll", update);
  }

  return { el, canLeft, canRight, scroll, attach, detach };
}

const composerRow = useScrollRow();
const similarRow = useScrollRow();

function extractCoverColor(img: HTMLImageElement) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 50, 50);
    const { data } = ctx.getImageData(0, 0, 50, 50);
    let r = 0,
      g = 0,
      b = 0,
      count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (!count) return;
    const nr = r / count / 255,
      ng = g / count / 255,
      nb = b / count / 255;
    const max = Math.max(nr, ng, nb),
      min = Math.min(nr, ng, nb),
      d = max - min;
    let h = 0;
    if (d > 0) {
      if (max === nr) h = ((ng - nb) / d + 6) % 6;
      else if (max === ng) h = (nb - nr) / d + 2;
      else h = (nr - ng) / d + 4;
      h = h / 6;
    }
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    coverColor.value = `hsl(${Math.round(h * 360)}, ${Math.round(Math.min(1, s * 2.5) * 100)}%, 60%)`;
  } catch {
    // cross-origin — leave coverColor empty, CSS falls back to accent
  }
}

function play() {
  if (track.value) store.setNowPlaying(track.value);
}

function toggleLike() {
  if (!track.value) return;
  const delta = liked.value ? -1 : 1;
  liked.value = !liked.value;
  store.likeSoundtrack(id, delta);
}

onMounted(async () => {
  await store.loadAll();
  if (!track.value) notFound.value = true;
  composerRow.attach();
  similarRow.attach();
});

onUnmounted(() => {
  composerRow.detach();
  similarRow.detach();
});
</script>

<template>
  <div v-if="notFound" class="not-found">
    <p>Soundtrack not found.</p>
    <button @click="router.push('/')">Go home</button>
  </div>

  <div v-else-if="track" class="soundtrack-page">
    <!-- Back button — anchored to page top-left, outside the centered hero -->
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
        track.cover_image_url
          ? `background-image: url('${track.cover_image_url}')`
          : ''
      "
    />

    <!-- Hero -->
    <div class="hero">
      <div class="hero-body">
        <div
          class="cover-wrap"
          @click="play"
          :style="coverColor ? { '--cover-color': coverColor } : {}"
        >
          <img
            v-if="track.cover_image_url"
            :src="track.cover_image_url"
            :alt="track.game_title"
            class="cover-img"
            crossorigin="anonymous"
            @load="extractCoverColor($event.target as HTMLImageElement)"
          />
          <div v-else class="cover-fallback">🎮</div>
          <div class="cover-play-overlay">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        <div class="info">
          <div class="meta-line">
            <span class="source-badge">{{
              track.source_type === "playlist" ? "Full OST" : "Video"
            }}</span>
            <span class="console">{{ track.console }}</span>
            <span class="year">{{ track.release_year }}</span>
          </div>

          <h1 class="game-title">{{ track.game_title }}</h1>
          <RouterLink
            :to="`/composer/${toSlug(track.composer)}`"
            class="composer"
            >{{ track.composer }}</RouterLink
          >

          <div class="actions">
            <button class="play-btn" @click="play">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                style="padding-left: 2px"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>

            <button class="like-btn" :class="{ liked }" @click="toggleLike">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M19.5 12.572l-7.5 7.428-7.5-7.428a5 5 0 1 1 7.5-6.566 5 5 0 1 1 7.5 6.572"
                />
              </svg>
              {{ track.likes }}
            </button>
          </div>

          <div
            v-if="track.genre_tags?.length || track.mood_tags?.length"
            class="tags"
          >
            <span
              v-for="tag in track.genre_tags"
              :key="tag"
              class="tag genre"
              >{{ tag }}</span
            >
            <span v-for="tag in track.mood_tags" :key="tag" class="tag mood">{{
              tag
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Streaming links -->
    <div v-if="track.streaming_links?.length" class="links-section">
      <h2 class="links-heading">Listen On</h2>
      <StreamingLinks :links="track.streaming_links" />
    </div>

    <!-- More from composer -->
    <div v-if="moreFromComposer.length" class="related-section">
      <h2 class="related-heading">More from {{ track.composer }}</h2>
      <div class="row-wrap">
        <div
          :ref="
            (el) => {
              composerRow.el.value = el as HTMLElement | null;
            }
          "
          class="scroll-row"
        >
          <RouterLink
            v-for="s in moreFromComposer"
            :key="s.id"
            :to="`/soundtrack/${s.id}`"
            class="related-card"
          >
            <div class="related-cover">
              <img
                v-if="s.cover_image_url"
                :src="s.cover_image_url"
                :alt="s.game_title"
              />
              <span v-else class="related-fallback">🎮</span>
            </div>
            <p class="related-title">{{ s.game_title }}</p>
            <p class="related-meta">{{ s.release_year }}</p>
          </RouterLink>
        </div>
        <Transition name="fade">
          <button
            v-if="composerRow.canLeft.value"
            class="nav-edge nav-edge--left"
            @click="composerRow.scroll(-1)"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </Transition>
        <Transition name="fade">
          <button
            v-if="composerRow.canRight.value"
            class="nav-edge nav-edge--right"
            @click="composerRow.scroll(1)"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </Transition>
      </div>
    </div>

    <!-- Similar soundtracks -->
    <div v-if="similarSoundtracks.length" class="related-section">
      <h2 class="related-heading">You Might Also Like</h2>
      <div class="row-wrap">
        <div
          :ref="
            (el) => {
              similarRow.el.value = el as HTMLElement | null;
            }
          "
          class="scroll-row"
        >
          <RouterLink
            v-for="s in similarSoundtracks"
            :key="s.id"
            :to="`/soundtrack/${s.id}`"
            class="related-card"
          >
            <div class="related-cover">
              <img
                v-if="s.cover_image_url"
                :src="s.cover_image_url"
                :alt="s.game_title"
              />
              <span v-else class="related-fallback">🎮</span>
            </div>
            <p class="related-title">{{ s.game_title }}</p>
            <p class="related-meta">{{ s.composer }} · {{ s.release_year }}</p>
          </RouterLink>
        </div>
        <Transition name="fade">
          <button
            v-if="similarRow.canLeft.value"
            class="nav-edge nav-edge--left"
            @click="similarRow.scroll(-1)"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </Transition>
        <Transition name="fade">
          <button
            v-if="similarRow.canRight.value"
            class="nav-edge nav-edge--right"
            @click="similarRow.scroll(1)"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </Transition>
      </div>
    </div>
  </div>

  <!-- Loading skeleton -->
  <div v-else class="loading">
    <div class="skeleton cover-skeleton" />
    <div class="skeleton-lines">
      <div class="skeleton line-lg" />
      <div class="skeleton line-md" />
      <div class="skeleton line-sm" />
    </div>
  </div>
</template>

<style scoped>
.soundtrack-page {
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

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.hero {
  position: relative;
  padding: 2rem 3rem 3rem;
  max-width: 1100px;
  margin: 0 auto;
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

.hero-body {
  display: flex;
  gap: 3rem;
  align-items: flex-end;
}

/* ── Cover ────────────────────────────────────────────────────────────────── */
.cover-wrap {
  position: relative;
  flex-shrink: 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
  background: var(--surface-2);
  cursor: pointer;
  transition: box-shadow 0.5s ease;
}

.cover-wrap:hover {
  box-shadow:
    0 0 0 2px
      color-mix(in srgb, var(--cover-color, var(--accent)) 75%, transparent),
    0 32px 80px
      color-mix(in srgb, var(--cover-color, #000) 25%, rgba(0, 0, 0, 0.75));
}

.cover-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cover-wrap:hover .cover-play-overlay {
  opacity: 1;
}

.cover-wrap:hover .cover-img {
  transform: scale(1.04);
  transition: transform 0.3s ease;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
}

/* ── Info ─────────────────────────────────────────────────────────────────── */
.info {
  flex: 1;
  min-width: 0;
  padding-bottom: 0.25rem;
}

.meta-line {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.source-badge {
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.meta-line .console::before,
.meta-line .year::before {
  content: "·";
  margin-right: 0.6rem;
}

.game-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.5rem, 5vw, 4.5rem);
  font-weight: 400;
  letter-spacing: 0.04em;
  line-height: 1;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.composer {
  font-size: 1.05rem;
  color: var(--text-secondary);
  margin: 0 0 1.75rem;
  text-decoration: none;
  display: block;
  transition: color 0.15s;
}

.composer:hover {
  color: var(--text-primary);
}

/* ── Actions ──────────────────────────────────────────────────────────────── */
.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.play-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.75rem;
  border-radius: 99px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.1s;
}

.play-btn:hover {
  background: var(--accent-hover);
}

.play-btn:active {
  transform: scale(0.97);
}

.like-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 1rem;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.88rem;
  cursor: pointer;
  transition:
    border-color 0.15s,
    color 0.15s,
    background 0.15s;
}

.like-btn:hover {
  border-color: #f5686c;
  color: #f5686c;
}

.like-btn.liked {
  color: #f5686c;
  border-color: #f5686c;
  background: rgba(245, 104, 108, 0.08);
}

.like-btn.liked svg {
  fill: #f5686c;
  stroke: #f5686c;
}

/* ── Tags ─────────────────────────────────────────────────────────────────── */
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tag {
  padding: 0.25rem 0.65rem;
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: capitalize;
}

.tag.genre {
  background: var(--surface-2);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.tag.mood {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent-light, var(--accent));
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
}

/* ── Streaming links ──────────────────────────────────────────────────────── */
.links-section {
  position: relative;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 3rem 4rem;
}

.links-heading {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  margin: 0 0 1rem;
}

/* ── Loading ──────────────────────────────────────────────────────────────── */
.loading {
  display: flex;
  gap: 3rem;
  padding: 4rem 3rem;
  max-width: 1100px;
  margin: 0 auto;
}

.skeleton {
  background: var(--surface-2);
  border-radius: 8px;
  animation: shimmer 1.4s infinite;
}

.cover-skeleton {
  flex-shrink: 0;
  width: 260px;
  height: 260px;
}

.skeleton-lines {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 1rem;
  flex: 1;
}

.line-lg {
  height: 3rem;
  width: 70%;
}
.line-md {
  height: 1.2rem;
  width: 40%;
}
.line-sm {
  height: 1rem;
  width: 25%;
}

@keyframes shimmer {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.7;
  }
}

/* ── Related rows ─────────────────────────────────────────────────────────── */
.related-section {
  position: relative;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 3rem 3rem;
}

.related-heading {
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: white;
  opacity: 0.85;
  margin: 0 0 1rem;
}

.row-wrap {
  position: relative;
}

.scroll-row {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 0.5rem;
}

.scroll-row::-webkit-scrollbar {
  display: none;
}

.nav-edge {
  position: absolute;
  top: 0;
  bottom: 0.5rem;
  width: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
  color: #fff;
  transition: background 0.15s;
}

.nav-edge--left {
  left: 0;
}
.nav-edge--right {
  right: 0;
}

.nav-edge:hover {
  background: rgba(0, 0, 0, 0.75);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scroll-row::-webkit-scrollbar {
  display: none;
}

.related-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex-shrink: 0;
  width: 160px;
  text-decoration: none;
  cursor: pointer;
}

.related-cover {
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.15s,
    box-shadow 0.15s;
}

.related-card:hover .related-cover {
  transform: scale(1.03);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.related-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.related-fallback {
  font-size: 2rem;
}

.related-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.related-meta {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Not found ────────────────────────────────────────────────────────────── */
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 1rem;
  color: var(--text-muted);
}

.not-found button {
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
</style>
