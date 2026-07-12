<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: number; // 0–100
    readonly?: boolean;
    small?: boolean;
  }>(),
  { readonly: false, small: false },
);

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const containerRef = ref<HTMLElement | null>(null);
const hoverScore = ref<number | null>(null);
const isDragging = ref(false);

const displayScore = computed(() => hoverScore.value ?? props.modelValue);
const clipRight = computed(() => `${100 - displayScore.value}%`);

// Faded only when hovering without dragging (preview mode)
const isPreviewHover = computed(() => hoverScore.value !== null && !isDragging.value);

function scoreFromClientX(clientX: number): number {
  if (!containerRef.value) return 0;
  const rect = containerRef.value.getBoundingClientRect();
  const raw = ((clientX - rect.left) / rect.width) * 100;
  return Math.min(100, Math.max(5, Math.round(raw / 5) * 5));
}

// ── Mouse ────────────────────────────────────────────────────────────────────

function onMouseDown(e: MouseEvent) {
  if (props.readonly) return;
  isDragging.value = true;
  hoverScore.value = scoreFromClientX(e.clientX);
}

function onMouseMove(e: MouseEvent) {
  if (props.readonly) return;
  hoverScore.value = scoreFromClientX(e.clientX);
}

function onMouseLeave() {
  if (!isDragging.value) hoverScore.value = null;
}

function onDocMouseUp(e: MouseEvent) {
  if (!isDragging.value) return;
  emit("update:modelValue", scoreFromClientX(e.clientX));
  isDragging.value = false;
  hoverScore.value = null;
}

// ── Touch ─────────────────────────────────────────────────────────────────────
// Registered manually with { passive: false } so preventDefault() works,
// which stops the page scrolling while the user drags across the stars.

function touchClientX(e: TouchEvent): number {
  return (e.touches[0] ?? e.changedTouches[0]).clientX;
}

function onTouchStart(e: TouchEvent) {
  if (props.readonly) return;
  e.preventDefault();
  isDragging.value = true;
  hoverScore.value = scoreFromClientX(touchClientX(e));
}

function onTouchMove(e: TouchEvent) {
  if (props.readonly) return;
  e.preventDefault();
  hoverScore.value = scoreFromClientX(touchClientX(e));
}

function onTouchEnd(e: TouchEvent) {
  if (props.readonly) return;
  emit("update:modelValue", scoreFromClientX(touchClientX(e)));
  isDragging.value = false;
  hoverScore.value = null;
}

onMounted(() => {
  document.addEventListener("mouseup", onDocMouseUp);
  const el = containerRef.value;
  if (el) {
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd);
  }
});

onUnmounted(() => {
  document.removeEventListener("mouseup", onDocMouseUp);
  const el = containerRef.value;
  if (el) {
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchmove",  onTouchMove);
    el.removeEventListener("touchend",   onTouchEnd);
  }
});
</script>

<template>
  <div
    ref="containerRef"
    class="stars"
    :class="{
      'stars--interactive': !readonly,
      'stars--small': small,
      'stars--preview': isPreviewHover,
    }"
    :aria-label="`Rating: ${modelValue} out of 100`"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- Empty stars — base layer -->
    <div class="stars-layer stars-empty">
      <svg v-for="i in 5" :key="i" viewBox="0 0 24 24" class="star-svg">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </div>

    <!-- Filled gold stars — clipped to displayScore% from the left -->
    <div class="stars-layer stars-filled" :style="{ clipPath: `inset(0 ${clipRight} 0 0)` }">
      <svg v-for="i in 5" :key="i" viewBox="0 0 24 24" class="star-svg">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.stars {
  position: relative;
  display: inline-flex;
  align-self: flex-start;
  user-select: none;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.stars--interactive {
  cursor: pointer;
}

.stars-layer {
  display: flex;
  gap: 3px;
  pointer-events: none;
}

.stars-filled {
  position: absolute;
  inset: 0;
  overflow: hidden;
  transition: clip-path 0.04s linear;
}

.star-svg {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.stars--small .star-svg {
  width: 16px;
  height: 16px;
}

.stars-empty .star-svg {
  fill: color-mix(in srgb, var(--text-muted) 40%, transparent);
}

.stars-filled .star-svg {
  fill: #f5a623;
}

/* Faded only during hover preview (not while actively dragging) */
.stars--preview .stars-filled .star-svg {
  fill: rgba(255, 207, 130, 0.849);
}
</style>
