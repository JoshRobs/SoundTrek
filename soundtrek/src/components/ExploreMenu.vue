<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import MegaFeatured from "./MegaFeatured.vue";
import MegaCategories from "./MegaCategories.vue";
import MegaComposers from "./MegaComposers.vue";
import MegaStudios from "./MegaStudios.vue";

const router = useRouter();
const open = ref(false);
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function onEnter() {
  if (closeTimer) clearTimeout(closeTimer);
  open.value = true;
}

function onLeave() {
  closeTimer = setTimeout(() => {
    open.value = false;
  }, 200);
}

function navigate(path: string) {
  open.value = false;
  router.push(path);
}
</script>

<template>
  <div class="explore-wrap" @mouseenter="onEnter" @mouseleave="onLeave">
    <button
      class="explore-btn"
      :class="{ active: open }"
      @click="navigate('/explore')"
    >
      Explore
      <svg
        class="chevron"
        :class="{ open }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <Transition name="mega">
      <div
        v-if="open"
        class="mega"
        role="navigation"
        @mouseenter="onEnter"
        @mouseleave="onLeave"
      >
        <div class="mega-inner">
          <MegaFeatured @navigate="navigate" />
          <div class="col-divider" />
          <MegaCategories @navigate="navigate" />
          <div class="col-divider" />
          <MegaComposers @navigate="navigate" />
          <div class="col-divider" />
          <MegaStudios @navigate="navigate" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.explore-wrap {
  /* hover target */
}

.explore-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}

.explore-btn:hover,
.explore-btn.active {
  color: var(--text-primary);
  background: var(--surface-2);
  border-color: var(--border);
}

.chevron {
  transition: transform 0.2s ease;
}
.chevron.open {
  transform: rotate(180deg);
}

.mega {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.mega-inner {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  gap: 0;
  padding: 1.75rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.col-divider {
  width: 1px;
  background: var(--border);
  margin: 0 0.5rem;
}

.mega-enter-active,
.mega-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.mega-enter-from,
.mega-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
