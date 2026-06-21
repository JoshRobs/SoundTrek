<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { toSlug } from "@/utils/slug";
import ExploreCard from "./ExploreCard.vue";
import type { Soundtrack } from "@/types/soundtrack";

const props = defineProps<{
  type: string;
  label: string;
  items: Soundtrack[];
}>();

const router = useRouter();
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

const typeLabels: Record<string, string> = {
  genre: "Genre",
  mood: "Mood",
  theme: "Theme",
  console: "Console",
};

function seeAll() {
  router.push(`/category/${props.type}/${toSlug(props.label)}`);
}
</script>

<template>
  <section class="row">
    <div class="row-header">
      <div class="row-label-group">
        <h2 class="row-label">{{ label }}</h2>
        <span class="type-badge">{{ typeLabels[type] ?? type }}</span>
      </div>
      <button class="see-all" @click="seeAll">
        See All
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <div class="track-wrap">
      <div ref="trackRef" class="scroll-track">
        <ExploreCard v-for="s in items" :key="s.id" :soundtrack="s" />
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

.row-label-group {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.row-label {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  text-transform: capitalize;
}

.type-badge {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.see-all {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  white-space: nowrap;
  padding: 0;
  transition: color 0.15s;
}

.see-all:hover {
  color: var(--accent-light);
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
</style>
