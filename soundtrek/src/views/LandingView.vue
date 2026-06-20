<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import GameSearchBox from "@/components/GameSearchBox.vue";
import { useSoundtrackStore } from "@/stores/soundtracks";
import type { Soundtrack } from "@/types/soundtrack";

const router = useRouter();
const store = useSoundtrackStore();
const { allSoundtracks } = storeToRefs(store);

function surpriseMe() {
  router.push("/discover");
}

function play(s: Soundtrack) {
  store.setNowPlaying(s);
  router.push("/discover");
}

const nowListeningItems = ref<Soundtrack[]>([]);
const featuredItems = ref<Soundtrack[]>([]);
const recentItems = ref<Soundtrack[]>([]);

onMounted(async () => {
  await store.loadAll();
  const all = allSoundtracks.value;
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  nowListeningItems.value = shuffled.slice(0, 3);
  featuredItems.value = shuffled.slice(3, 7);
  recentItems.value = [...all]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 5);
});
</script>

<template>
  <div class="landing">
    <div class="hero">
      <p class="logo">SoundTrek</p>
      <p class="tagline">Discover video game soundtracks</p>
      <GameSearchBox @select="(id) => router.push(`/discover?id=${id}`)" />
      <button class="surprise-btn" @click="surpriseMe">
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
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          />
        </svg>
        Surprise Me
      </button>
    </div>

    <div class="sections">
      <!-- Section 1: Now Listening — title left -->
      <section class="landing-section">
        <div class="section-title">
          <p class="section-label">Trending</p>
          <h2 class="section-heading">What people are listening to now</h2>
        </div>
        <div class="section-content">
          <div class="cover-row">
            <button
              v-for="s in nowListeningItems"
              :key="s.id"
              class="cover-card"
              @click="play(s)"
            >
              <img
                v-if="s.cover_image_url"
                :src="s.cover_image_url"
                :alt="s.game_title"
                class="cover-img"
              />
              <div v-else class="cover-fallback">🎮</div>
              <div class="cover-overlay">
                <span class="cover-title">{{ s.game_title }}</span>
              </div>
            </button>
          </div>
        </div>
      </section>

      <!-- Section 2: Featured — title right -->
      <section class="landing-section section--reverse">
        <div class="section-title">
          <p class="section-label">Featured</p>
          <h2 class="section-heading">Featured Tracks</h2>
        </div>
        <div class="section-content">
          <div class="cover-grid">
            <button
              v-for="s in featuredItems"
              :key="s.id"
              class="cover-card"
              @click="play(s)"
            >
              <img
                v-if="s.cover_image_url"
                :src="s.cover_image_url"
                :alt="s.game_title"
                class="cover-img"
              />
              <div v-else class="cover-fallback">🎮</div>
              <div class="cover-overlay">
                <span class="cover-title">{{ s.game_title }}</span>
              </div>
            </button>
          </div>
        </div>
      </section>

      <!-- Section 3: Recently Added — title left -->
      <section class="landing-section">
        <div class="section-title">
          <p class="section-label">New</p>
          <h2 class="section-heading">Recently Added</h2>
        </div>
        <div class="section-content">
          <div class="recent-list">
            <button
              v-for="(s, i) in recentItems"
              :key="s.id"
              class="recent-item"
              @click="play(s)"
            >
              <span class="recent-rank">{{ i + 1 }}</span>
              <div class="recent-thumb">
                <img
                  v-if="s.cover_image_url"
                  :src="s.cover_image_url"
                  :alt="s.game_title"
                />
                <span v-else class="thumb-fallback">🎮</span>
              </div>
              <div class="recent-info">
                <span class="recent-game">{{ s.game_title }}</span>
                <span class="recent-meta"
                  >{{ s.composer }} · {{ s.release_year }}</span
                >
              </div>
              <svg
                class="recent-arrow"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.landing {
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

/* ── Hero ─────────────────────────────────────────────────────────────── */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  width: 100%;
  max-width: 560px;
  min-height: 100vh;
  padding: 4rem 1rem;
  margin: 0 auto;
  background-image: radial-gradient(
    ellipse at 50% 55%,
    color-mix(in srgb, var(--accent) 10%, transparent) 0%,
    transparent 65%
  );
}

.logo {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(3.5rem, 10vw, 5.5rem);
  letter-spacing: 0.06em;
  line-height: 1;
  color: var(--text-primary);
  text-align: center;
}

.tagline {
  margin: -0.5rem 0 0.5rem;
  font-size: 0.9rem;
  color: var(--text-muted);
  text-align: center;
  letter-spacing: 0.03em;
}

.surprise-btn {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 2.25rem;
  border-radius: 12px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.1s,
    box-shadow 0.15s;
  box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 40%, transparent);
}

.surprise-btn:hover {
  background: var(--accent-hover);
  box-shadow: 0 6px 28px color-mix(in srgb, var(--accent) 55%, transparent);
  transform: translateY(-1px);
}

.surprise-btn:active {
  transform: translateY(0);
}

/* ── Sections ─────────────────────────────────────────────────────────── */
.sections {
  width: 100%;
  padding: 0 2.5rem 6rem;
}

.landing-section {
  display: flex;
  align-items: center;
  gap: 5rem;
  padding: 4rem 0;
  border-top: 1px solid var(--border);
}

.section--reverse {
  flex-direction: row-reverse;
}

.section-title {
  flex: 0 0 35%;
  min-width: 0;
}

.section-label {
  margin: 0 0 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--accent);
}

.section-heading {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  font-weight: 400;
  letter-spacing: 0.04em;
  line-height: 1.1;
  color: var(--text-primary);
}

.section-content {
  flex: 1;
  min-width: 0;
}

/* ── Cover card (shared) ──────────────────────────────────────────────── */
.cover-card {
  position: relative;
  border: none;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
  cursor: pointer;
  padding: 0;
  display: block;
  transition:
    transform 0.18s,
    box-shadow 0.18s;
}

.cover-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
}

.cover-card:hover .cover-overlay {
  opacity: 1;
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
  font-size: 3rem;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 55%);
  display: flex;
  align-items: flex-end;
  padding: 0.75rem;
  opacity: 0;
  transition: opacity 0.18s;
}

.cover-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.2;
  text-align: left;
}

/* ── Section 1: Now Listening row ─────────────────────────────────────── */
.cover-row {
  display: flex;
  gap: 1rem;
}

.cover-row .cover-card {
  flex: 1;
  aspect-ratio: 1;
}

/* ── Section 2: Featured grid ─────────────────────────────────────────── */
.cover-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  max-width: 700px;
}

.cover-grid .cover-card {
  aspect-ratio: 1;
}

/* ── Section 3: Recently Added ────────────────────────────────────────── */
.recent-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0.75rem;
  border-radius: 9px;
  border: none;
  background: transparent;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background 0.12s;
}

.recent-item:hover {
  background: var(--surface-2);
}

.recent-item:hover .recent-arrow {
  opacity: 1;
  transform: translateX(2px);
}

.recent-rank {
  flex-shrink: 0;
  width: 1.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  text-align: center;
}

.recent-thumb {
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: 7px;
  overflow: hidden;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.recent-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-fallback {
  font-size: 1.3rem;
}

.recent-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.recent-game {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-meta {
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-arrow {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0;
  transition:
    opacity 0.12s,
    transform 0.12s;
}
</style>
