<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { storeToRefs } from "pinia";
import GameSearchBox from "@/components/GameSearchBox.vue";
import RandomizeButton from "@/components/RandomizeButton.vue";
import { useSoundtrackStore } from "@/stores/soundtracks";
import type { Soundtrack } from "@/types/soundtrack";
import { animate, stagger } from "animejs";
import { useNotePlayer } from "@/composables/useNotePlayer";

const text = "SOUNDTREK".split("");
const { playNote } = useNotePlayer();

// Animate up on hover
const hoverIn = (el: EventTarget | null, index: number) => {
  if (!el) return;
  playNote(index);
  animate(el, {
    y: "-20",
    duration: 200,
    easing: "ease-out-bounce",
  });
};

// Drop back down on leave
const hoverOut = (el: EventTarget | null) => {
  if (!el) return;
  animate(el, {
    y: "0",
    duration: 300,
    easing: "ease-out-bounce",
  });
};

useHead({
  title: "SoundTrek | Discover Video Game Soundtracks",
  meta: [
    {
      name: "description",
      content:
        "Discover and explore video game soundtracks. Find music by genre, mood, console, and more.",
    },
    {
      property: "og:title",
      content: "SoundTrek | Discover Video Game Soundtracks",
    },
    {
      property: "og:description",
      content:
        "Discover and explore video game soundtracks. Find music by genre, mood, console, and more.",
    },
    { property: "og:url", content: "https://soundtrek.app/" },
  ],
});

const buildDate = __BUILD_DATE__;

const router = useRouter();
const store = useSoundtrackStore();

function scrollToTop() {
  document.getElementById("app-main")?.scrollTo({ top: 0, behavior: "smooth" });
}
const { allSoundtracks } = storeToRefs(store);

function randomSoundtrack() {
  store.currentSoundtrack = null;
  router.push("/discover");
}

function play(s: Soundtrack) {
  router.push(`/soundtrack/${s.id}`);
}

const nowListeningItems = ref<Soundtrack[]>([]);
const featuredItems = ref<Soundtrack[]>([]);
const recentItems = ref<Soundtrack[]>([]);

function buildSections(all: Soundtrack[]) {
  if (!all.length || nowListeningItems.value.length > 0) return;
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  nowListeningItems.value = shuffled.slice(0, 3);
  featuredItems.value = shuffled.slice(3, 7);
  recentItems.value = [...all]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 4);
}

// Build immediately if store already has data (returning from another page),
// so the page renders at full height before the router restores scroll position
buildSections(allSoundtracks.value);

onMounted(async () => {
  await store.loadAll();
  buildSections(allSoundtracks.value);

  animate(".letter", {
    y: [{ to: ["-40", "0"] }, { to: "0%", delay: 1000, ease: "in(3)" }],
    duration: 1000,
    ease: "out(3)",
    delay: stagger(40),
    fill: "forwards",
  });
});
</script>

<template>
  <div class="landing">
    <div class="hero">
      <p class="logo">
        <span
          v-for="(char, i) in text"
          :key="i"
          class="letter"
          @mouseenter="hoverIn($event.target, i)"
          @mouseleave="hoverOut($event.target)"
          >{{ char }}</span
        >
      </p>
      <p class="tagline">Discover video game soundtracks</p>
      <GameSearchBox @select="(id) => router.push(`/soundtrack/${id}`)" />
      <RandomizeButton @click="randomSoundtrack" />
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
                <button
                  class="overlay-play"
                  @click.stop="store.setNowPlaying(s)"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
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
          <h2 class="section-heading">Our favourite Soundtracks</h2>
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
                <button
                  class="overlay-play"
                  @click.stop="store.setNowPlaying(s)"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
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
          <div class="cover-row">
            <button
              v-for="s in recentItems"
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
                <button
                  class="overlay-play"
                  @click.stop="store.setNowPlaying(s)"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <span class="cover-title">{{ s.game_title }}</span>
              </div>
            </button>
          </div>
        </div>
      </section>
    </div>

    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="footer-logo">SoundTrek</span>
          <p class="footer-tagline">
            Discover video game soundtracks, one at a time.
          </p>
        </div>

        <nav class="footer-nav">
          <div class="footer-col">
            <p class="footer-col-heading">Discover</p>
            <RouterLink to="/discover" class="footer-link">Discover</RouterLink>
            <RouterLink to="/explore" class="footer-link">Explore</RouterLink>
            <RouterLink to="/catalog" class="footer-link">Catalog</RouterLink>
            <RouterLink to="/studios" class="footer-link">Studios</RouterLink>
          </div>
          <div class="footer-col">
            <p class="footer-col-heading">Charts</p>
            <RouterLink to="/top" class="footer-link"
              >Top Soundtracks</RouterLink
            >
            <RouterLink to="/top-composers" class="footer-link"
              >Top Composers</RouterLink
            >
          </div>
          <div class="footer-col">
            <p class="footer-col-heading">Contribute</p>
            <RouterLink to="/submit" class="footer-link"
              >Submit a Soundtrack</RouterLink
            >
            <RouterLink to="/contact" class="footer-link"
              >Contact Us</RouterLink
            >
            <RouterLink to="/privacy-policy" class="footer-link"
              >Privacy Policy</RouterLink
            >
            <RouterLink to="/terms-of-service" class="footer-link"
              >Terms of Service</RouterLink
            >
          </div>
        </nav>
      </div>

      <div class="footer-bottom">
        <div class="footer-bottom-left">
          <p class="footer-copy">
            © {{ new Date().getFullYear() }} SoundTrek. All rights reserved.
          </p>
          <p class="footer-disclaimer">
            SoundTrek is a fan project. All game titles and soundtracks are
            property of their respective owners.
          </p>
          <p class="footer-meta">
            Made with ♥ by Joshua Roberts &nbsp;·&nbsp; Updated {{ buildDate }}
            &nbsp;·&nbsp;
            <a
              href="/rss.xml"
              class="footer-rss"
              target="_blank"
              rel="noopener"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"
                />
              </svg>
              RSS
            </a>
          </p>
        </div>
        <button
          class="back-to-top"
          @click="scrollToTop"
          aria-label="Back to top"
        >
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
            <polyline points="18 15 12 9 6 15" />
          </svg>
          Back to top
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.letter {
  display: inline-block;
  user-select: none;
  transform: translateY(0);
  cursor: pointer;
}
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
  padding: 4rem 1rem 12rem;
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
  font-size: clamp(3.5rem, 10vw, 6.5rem);
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

/* ── Sections ─────────────────────────────────────────────────────────── */
.sections {
  width: 100%;
  padding: 0 2.5rem 0rem;
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
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--accent);
}

.section-heading {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.2rem, 4vw, 4rem);
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
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  opacity: 0;
  transition: opacity 0.18s;
}

.cover-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.2;
  text-align: center;
}

.overlay-play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  cursor: pointer;
  padding-left: 3px;
  transition:
    background 0.15s,
    transform 0.15s;
}

.overlay-play:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

/* ── Section 1: Now Listening row ─────────────────────────────────────── */
.cover-row {
  display: flex;
  gap: 1rem;
}

.cover-row .cover-card {
  flex: 1;
  aspect-ratio: 3/4;
}

/* ── Section 2: Featured grid ─────────────────────────────────────────── */
.cover-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  max-width: 600px;
}

.cover-grid .cover-card {
  aspect-ratio: 3 / 4;
}

/* ── Footer ───────────────────────────────────────────────────────────── */
.footer {
  border-top: 1px solid var(--border);
  padding: 3.5rem 2.5rem 2rem;
  background: var(--bg);
}

.footer-inner {
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 3rem;
  padding-bottom: 2.5rem;
  border-bottom: 1px solid var(--border);
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-logo {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.8rem;
  letter-spacing: 0.06em;
  color: var(--text-primary);
  line-height: 1;
}

.footer-tagline {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
  max-width: 220px;
  line-height: 1.5;
}

.footer-nav {
  display: flex;
  gap: 4rem;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.footer-col-heading {
  margin: 0 0 0.25rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.footer-link {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.15s;
  width: fit-content;
}

.footer-link:hover {
  color: var(--text-primary);
}

.footer-bottom {
  max-width: 1200px;
  margin: 0 auto;
  padding-top: 1.5rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}

.footer-bottom-left {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.footer-copy {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.footer-disclaimer {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted);
  opacity: 0.6;
  max-width: 480px;
}

.footer-meta {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted);
  opacity: 0.55;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.footer-rss {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: inherit;
  text-decoration: none;
  transition: opacity 0.15s;
}

.footer-rss:hover {
  opacity: 1;
  color: var(--accent);
}

.back-to-top {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.15s,
    border-color 0.15s;
  flex-shrink: 0;
}

.back-to-top:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

/* ── Mobile ───────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .hero {
    min-height: 100svh;
    padding: 3.5rem 1.25rem 4rem;
    gap: 1rem;
  }

  .sections {
    padding: 0 1rem 4rem;
  }

  .landing-section {
    flex-direction: column;
    gap: 1.25rem;
    padding: 2rem 0;
  }

  .section--reverse {
    flex-direction: column;
  }

  .section-title {
    flex: none;
    width: 100%;
  }

  .section-label {
    font-size: 0.95rem;
    margin-bottom: 0.3rem;
  }

  .section-heading {
    font-size: clamp(1.7rem, 6vw, 2.4rem);
  }

  .cover-overlay {
    display: none;
  }

  .cover-row {
    gap: 0.6rem;
  }

  .cover-row .cover-card,
  .cover-grid .cover-card {
    aspect-ratio: unset;
  }

  .cover-row .cover-img,
  .cover-grid .cover-img {
    height: auto;
    aspect-ratio: 3 / 4;
  }

  .cover-grid {
    max-width: 100%;
    gap: 0.6rem;
  }

  .footer {
    padding: 2.5rem 1.25rem 2rem;
  }

  .footer-inner {
    flex-direction: column;
    gap: 1.5rem;
  }

  .footer-nav {
    flex-wrap: wrap;
    gap: 1.5rem 2.5rem;
  }

  .footer-bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .back-to-top {
    align-self: flex-start;
  }
}
</style>
