<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import CoverCard from "@/components/CoverCard.vue";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { useListens } from "@/composables/useListens";
import type { Soundtrack } from "@/types/soundtrack";

const MAX = 15;

const router = useRouter();
const store = useSoundtrackStore();
const { allSoundtracks } = storeToRefs(store);
const { listenedOrder } = useListens();

// Resolve recent ids → soundtracks, newest-first, skipping any no longer in the
// catalog. Mirrors how LikedView resolves likedOrder.
const items = computed<Soundtrack[]>(() => {
  const byId = new Map(allSoundtracks.value.map((s) => [s.id, s]));
  const out: Soundtrack[] = [];
  for (const id of listenedOrder.value) {
    const s = byId.get(id);
    if (s) out.push(s);
    if (out.length >= MAX) break;
  }
  return out;
});

function navigate(s: Soundtrack) {
  router.push(`/soundtrack/${s.slug ?? s.id}`);
}
function play(s: Soundtrack) {
  store.setNowPlaying(s);
}

// Horizontal scroll with edge arrows (same behaviour as ExploreRow).
const trackRef = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(true);

function updateScroll() {
  const el = trackRef.value;
  if (!el) return;
  canScrollLeft.value = el.scrollLeft > 0;
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function scrollBy(dir: number) {
  trackRef.value?.scrollBy({ left: dir * 660, behavior: "smooth" });
}

onMounted(() => {
  updateScroll();
  trackRef.value?.addEventListener("scroll", updateScroll, { passive: true });
});

onUnmounted(() => {
  trackRef.value?.removeEventListener("scroll", updateScroll);
});
</script>

<template>
  <section v-if="items.length" class="row">
    <div class="row-header">
      <h2 class="row-label">Recently listened</h2>
    </div>

    <div class="track-wrap">
      <div ref="trackRef" class="scroll-track">
        <div v-for="s in items" :key="s.id" class="card-slot">
          <CoverCard
            :soundtrack="s"
            show-info
            @click="navigate(s)"
            @play="play(s)"
          />
        </div>
      </div>

      <Transition name="fade">
        <button
          v-if="canScrollLeft"
          class="nav-edge nav-edge--left"
          @click="scrollBy(-2)"
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
          v-if="canScrollRight"
          class="nav-edge nav-edge--right"
          @click="scrollBy(2)"
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
  </section>
</template>

<style scoped>
.row {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.row-label {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.track-wrap {
  position: relative;
}

.scroll-track {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.scroll-track::-webkit-scrollbar {
  display: none;
}

.card-slot {
  width: 220px;
  flex-shrink: 0;
}

/* Keep the cover a consistent 3/4 regardless of image aspect. */
.card-slot :deep(.cover-wrap) {
  aspect-ratio: 3 / 4;
}

.nav-edge {
  position: absolute;
  top: 0;
  bottom: 0;
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

@media (max-width: 768px) {
  .row-label {
    font-size: 1.35rem;
  }

  .card-slot {
    width: 140px;
  }

  .nav-edge {
    display: none;
  }
}
</style>
