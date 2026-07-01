<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import type { Soundtrack } from "@/types/soundtrack";

const router = useRouter();

const props = defineProps<{ covers: Soundtrack[] }>();

interface CoverSlot {
  soundtrack: Soundtrack;
  style: Record<string, string | number>;
}

const slots = ref<CoverSlot[]>([]);

onMounted(() => {
  const vw = window.innerWidth;
  const bleed = 60; // px to bleed off each side symmetrically
  const step = (vw + 2 * bleed) / (props.covers.length - 1);
  slots.value = props.covers.map((s, i) => {
    // depth 0 = far (small, slow, faint), depth 1 = near (large, fast, opaque)
    const depth = Math.random();
    const width = Math.round(120 + depth * 136); // 104–260px
    const duration = 40 + (1 - depth) * 40 + Math.random() * 10; // 40–90s
    const leftPx = -bleed + i * step + (Math.random() - 0.5) * step * 0.8;
    const left = (leftPx / vw) * 100; // convert px → % relative to hero width
    const rot = (Math.random() - 0.5) * 14; // –7° to +7°

    return {
      soundtrack: s,
      style: {
        left: `${left.toFixed(1)}%`,
        width: `${width}px`,
        zIndex: Math.floor(Math.random() * 10),
        "--dur": `${duration.toFixed(1)}s`,
        // negative delay = already mid-fall on load, distributed across the full cycle
        "--delay": `-${(Math.random() * duration).toFixed(1)}s`,
        "--rot": `${rot.toFixed(1)}deg`,
      },
    };
  });
});
</script>

<template>
  <div class="hero-covers" aria-hidden="true">
    <div
      v-for="slot in slots"
      :key="slot.soundtrack.id"
      class="hero-cover"
      :style="slot.style"
      @click="router.push(`/soundtrack/${slot.soundtrack.id}`)"
    >
      <img
        :src="
          slot.soundtrack.cover_image_url_hd ??
          slot.soundtrack.cover_image_url ??
          ''
        "
        :alt="slot.soundtrack.game_title"
        class="hero-cover-img"
      />
    </div>
  </div>
</template>

<style scoped>
@keyframes fall {
  from {
    translate: 0 -280px;
  }
  to {
    translate: 0 110vh;
  }
}

.hero-covers {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.hero-cover {
  position: absolute;
  top: 0;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  will-change: translate;
  rotate: var(--rot);
  animation: fall var(--dur, 18s) linear infinite var(--delay, 0s);
  transition:
    rotate 0.4s ease,
    scale 0.4s ease,
    box-shadow 0.3s;
  pointer-events: auto;
}

.hero-cover::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.76);
  transition: background 0.4s;
}

.hero-cover:hover {
  animation-play-state: paused;
  rotate: 0deg;
  scale: 1.2;
  z-index: 20 !important;
  box-shadow: 0 0 18px color-mix(in srgb, white 14%, transparent);
  cursor: pointer;
}

.hero-cover:hover::after {
  background: rgba(0, 0, 0, 0.1);
}

.hero-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

@media (max-width: 768px) {
  .hero-cover {
    max-width: 200px;
    pointer-events: none;
    transition: none;
  }

  .hero-cover::after {
    background: rgba(0, 0, 0, 0.72);
  }
}
</style>
