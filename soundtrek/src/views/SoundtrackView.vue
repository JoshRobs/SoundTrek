<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import StreamingLinks from "@/components/StreamingLinks.vue";

const route = useRoute();
const router = useRouter();
const store = useSoundtrackStore();
const { allSoundtracks, nowPlaying } = storeToRefs(store);

const id = route.params.id as string;
const notFound = ref(false);
const liked = ref(false);

const track = computed(
  () => allSoundtracks.value.find((s) => s.id === id) ?? null,
);
const isPlaying = computed(() => nowPlaying.value?.id === id);

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
});
</script>

<template>
  <div v-if="notFound" class="not-found">
    <p>Soundtrack not found.</p>
    <button @click="router.push('/')">Go home</button>
  </div>

  <div v-else-if="track" class="soundtrack-page">
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
      <button class="back-btn" @click="router.back()">
        <svg
          width="16"
          height="16"
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

      <div class="hero-body">
        <div class="cover-wrap">
          <img
            v-if="track.cover_image_url"
            :src="track.cover_image_url"
            :alt="track.game_title"
            class="cover-img"
          />
          <div v-else class="cover-fallback">🎮</div>
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
          <p class="composer">{{ track.composer }}</p>

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
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem 0.4rem 0.5rem;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  margin-bottom: 2.5rem;
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
  flex-shrink: 0;
  width: 260px;
  height: 260px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
  background: var(--surface-2);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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
