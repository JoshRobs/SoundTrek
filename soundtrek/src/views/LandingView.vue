<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import GameSearchBox from "@/components/GameSearchBox.vue";
import RandomizeButton from "@/components/RandomizeButton.vue";
import HeroCovers from "@/components/HeroCovers.vue";
import { supabase, SOUNDTRACK_LIST_COLUMNS } from "@/lib/supabase";
import { useSoundtrackStore } from "@/stores/soundtracks";
import type { Soundtrack } from "@/types/soundtrack";
import { animate, stagger } from "animejs";
import { useNotePlayer } from "@/composables/useNotePlayer";
import CategoryBrowser from "@/components/CategoryBrowser.vue";
import CoverCard from "@/components/CoverCard.vue";

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
  link: [{ rel: "canonical", href: "https://soundtrek.app/" }],
});

const buildDate = __BUILD_DATE__;

const router = useRouter();
const store = useSoundtrackStore();

function scrollToTop() {
  document.getElementById("app-main")?.scrollTo({ top: 0, behavior: "smooth" });
}

function onSearchSelect(
  result:
    | { type: "soundtrack"; id: string }
    | { type: "composer"; slug: string },
) {
  if (result.type === "composer") router.push(`/composer/${result.slug}`);
  else router.push(`/soundtrack/${result.id}`);
}

function randomSoundtrack() {
  store.currentSoundtrack = null;
  router.push("/discover");
}

function play(s: Soundtrack) {
  router.push(`/soundtrack/${s.slug ?? s.id}`);
}

const nowListeningItems = ref<Soundtrack[]>([]);
const featuredItems = ref<Soundtrack[]>([]);
const recentItems = ref<Soundtrack[]>([]);
const heroCovers = ref<Soundtrack[]>([]);
const displayCount = ref(0);

async function buildSections() {
  const { count } = await supabase
    .from("soundtracks")
    .select("*", { count: "exact", head: true });
  const total = count ?? 0;

  // A random-offset page stands in for a shuffle of the whole catalog —
  // "random-ish" is enough for hero/now-listening/featured, and it avoids
  // pulling every row just to pick a handful.
  const batchSize = Math.min(60, total);
  const offset =
    total > batchSize ? Math.floor(Math.random() * (total - batchSize)) : 0;

  const [{ data: batch }, { data: recent }] = await Promise.all([
    batchSize > 0
      ? supabase
          .from("soundtracks")
          .select(SOUNDTRACK_LIST_COLUMNS)
          .range(offset, offset + batchSize - 1)
      : Promise.resolve({ data: [] as Soundtrack[] }),
    supabase
      .from("soundtracks")
      .select(SOUNDTRACK_LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const shuffled = [...((batch ?? []) as Soundtrack[])].sort(
    () => Math.random() - 0.5,
  );
  heroCovers.value = shuffled.filter((s) => s.cover_image_url).slice(0, 35);
  nowListeningItems.value = shuffled.slice(0, 4);
  featuredItems.value = shuffled.slice(4, 10);
  recentItems.value = (recent ?? []) as Soundtrack[];

  if (total > 0) {
    const counter = { n: 0 };
    animate(counter, {
      n: total,
      duration: 2200,
      ease: "out(3)",
      onUpdate: () => {
        displayCount.value = Math.round(counter.n);
      },
    });
  }
}

onMounted(() => {
  buildSections();

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
      <HeroCovers v-if="heroCovers.length" :covers="heroCovers" />

      <div class="hero-content">
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
        <GameSearchBox @select="onSearchSelect" />

        <div v-if="displayCount > 0" class="track-counter">
          <span class="counter-number">{{
            displayCount.toLocaleString()
          }}</span>
          <span class="counter-label">soundtracks to discover</span>
        </div>

        <RandomizeButton @click="randomSoundtrack" />
      </div>
    </div>

    <CategoryBrowser />

    <div class="sections">
      <!-- Section 1: Now Listening — title left -->
      <section class="landing-section">
        <div class="section-title">
          <p class="section-label">Trending</p>
          <h2 class="section-heading">What people are listening to now</h2>
        </div>
        <div class="section-content">
          <div class="cover-row">
            <CoverCard
              v-for="s in nowListeningItems"
              :key="s.id"
              :soundtrack="s"
              @click="play(s)"
              @play="store.setNowPlaying(s)"
            />
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
            <CoverCard
              v-for="s in featuredItems"
              :key="s.id"
              :soundtrack="s"
              @click="play(s)"
              @play="store.setNowPlaying(s)"
            />
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
            <CoverCard
              v-for="s in recentItems"
              :key="s.id"
              :soundtrack="s"
              @click="play(s)"
              @play="store.setNowPlaying(s)"
            />
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
            <p class="footer-col-heading">Library</p>
            <RouterLink to="/collections" class="footer-link"
              >My Collections</RouterLink
            >
            <RouterLink to="/liked" class="footer-link">Liked</RouterLink>
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
          <p class="footer-disclaimer">
            Game data powered by
            <a
              href="https://www.igdb.com"
              target="_blank"
              rel="noopener"
              class="footer-rss"
              >IGDB</a
            >.
          </p>
          <p class="footer-disclaimer">
            Icon made by
            <a
              href="https://www.freepik.com"
              target="_blank"
              rel="noopener"
              class="footer-rss"
              >Freepik</a
            >
            from
            <a
              href="https://www.flaticon.com"
              target="_blank"
              rel="noopener"
              class="footer-rss"
              >www.flaticon.com</a
            >.
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
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  background-image: radial-gradient(
    ellipse at 50% 55%,
    color-mix(in srgb, var(--accent) 10%, transparent) 0%,
    transparent 65%
  );
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 4rem 1rem 12rem;
  pointer-events: none;
}

.hero-content > * {
  pointer-events: auto;
}

.logo {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(3.5rem, 10vw, 6.5rem);
  letter-spacing: 0.06em;
  line-height: 1;
  color: var(--text-primary);
  text-align: center;
  text-shadow:
    -2px -2px rgb(0, 0, 0),
    4px 4px rgb(46, 46, 46);
}

.tagline {
  margin: -0.5rem 0 0.5rem;
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  color: var(--text-secondary);
  text-align: center;
  letter-spacing: 0.03em;
}

/* ── Track counter ────────────────────────────────────────────────────── */
.track-counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.counter-number {
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.8rem, 9vw, 4.5rem);
  line-height: 1;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  text-shadow:
    -2px -2px rgb(0, 0, 0),
    4px 4px rgb(24, 24, 24);
}

.counter-label {
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(1rem, 3vw, 1.6rem);
  letter-spacing: 0.12em;
  color: rgb(187, 187, 187);
  text-shadow: 1px 1px rgb(29, 29, 29);
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

/* ── Section 1: Now Listening row ─────────────────────────────────────── */
.cover-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
  gap: 1rem;
}

.cover-row .cover-card {
  aspect-ratio: 3/4;
}

/* ── Section 2: Featured grid ─────────────────────────────────────────── */
.cover-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
  max-width: 780px;
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
  }

  .hero-content {
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
    grid-template-columns: repeat(auto-fit, minmax(min(120px, 100%), 1fr));
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
