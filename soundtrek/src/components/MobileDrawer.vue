<script setup lang="ts">
import { nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useSoundtrackStore } from "@/stores/soundtracks";
import GameSearchBox from "./GameSearchBox.vue";
import { toSlug } from "@/utils/slug";

const emit = defineEmits<{ close: [] }>();
const router = useRouter();
const { topMoods } = storeToRefs(useSoundtrackStore());
const store = useSoundtrackStore();

function navigate(path: string) {
  emit("close");
  nextTick(() => router.push(path));
}

function randomPick() {
  store.nextSoundtrack();
  navigate("/discover");
}

function onSearchSelect(id: string) {
  navigate(`/soundtrack/${id}`);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-backdrop">
      <div class="backdrop" @click="emit('close')" />
    </Transition>

    <Transition name="drawer">
      <div class="drawer" role="dialog" aria-modal="true">
        <div class="drawer-header">
          <span class="drawer-logo">SoundTrek</span>
          <button class="close-btn" aria-label="Close menu" @click="emit('close')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="drawer-search">
          <GameSearchBox :autofocus="false" :compact="true" @select="onSearchSelect" />
        </div>

        <nav class="drawer-nav">
          <button class="nav-item" @click="navigate('/')">Home</button>
          <button class="nav-item" @click="randomPick">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
            </svg>
            Discover
          </button>
          <button class="nav-item" @click="navigate('/top')">Top Soundtracks</button>
          <button class="nav-item" @click="navigate('/top-composers')">Top Composers</button>
          <button class="nav-item" @click="navigate('/explore')">Explore</button>
          <button class="nav-item" @click="navigate('/catalog')">Catalog</button>
          <button class="nav-item" @click="navigate('/studios')">Studios</button>
        </nav>

        <div v-if="topMoods.length" class="drawer-section">
          <p class="section-label">Moods</p>
          <div class="mood-grid">
            <button
              v-for="m in topMoods"
              :key="m"
              class="mood-chip"
              @click="navigate(`/category/mood/${toSlug(m)}`)"
            >
              {{ m }}
            </button>
          </div>
        </div>

        <div class="drawer-footer">
          <button class="footer-link" @click="navigate('/submit')">Submit a Soundtrack</button>
          <button class="footer-link" @click="navigate('/contact')">Contact</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
}

.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(320px, 85vw);
  background: var(--surface);
  border-right: 1px solid var(--border);
  z-index: 201;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.drawer-logo {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.4rem;
  letter-spacing: 0.06em;
  background: linear-gradient(to right, var(--accent) 50%, var(--text-primary) 50%);
  background-size: 200% 100%;
  background-position: left;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.close-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

/* ── Search ───────────────────────────────────────────────────────────────── */
.drawer-search {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

/* ── Nav ──────────────────────────────────────────────────────────────────── */
.drawer-nav {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0;
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1.25rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.nav-item:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

/* ── Moods ────────────────────────────────────────────────────────────────── */
.drawer-section {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.section-label {
  margin: 0 0 0.65rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.mood-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.mood-chip {
  padding: 0.3rem 0.7rem;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.mood-chip:hover {
  border-color: var(--accent);
  color: var(--accent-light);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
.drawer-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
  padding: 0.5rem 0;
}

.footer-link {
  padding: 0.75rem 1.25rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.footer-link:hover {
  background: var(--surface-2);
  color: var(--text-secondary);
}

/* ── Transitions ──────────────────────────────────────────────────────────── */
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.25s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
}

.drawer-backdrop-enter-active,
.drawer-backdrop-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-backdrop-enter-from,
.drawer-backdrop-leave-to {
  opacity: 0;
}
</style>
