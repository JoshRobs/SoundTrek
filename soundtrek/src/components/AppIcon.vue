<script setup lang="ts">
import { computed } from "vue";

// Inline every SVG in assets/icons as a raw string at build time. Inlining
// (rather than <img src>) lets the icons inherit `currentColor` from their
// surroundings, and keeps them stylable/sizable like the old inline SVGs.
const modules = import.meta.glob("../assets/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const icons: Record<string, string> = {};
for (const [path, content] of Object.entries(modules)) {
  const name = path.split("/").pop()!.replace(/\.svg$/, "");
  icons[name] = content;
}

const props = withDefaults(
  defineProps<{
    /** File name in assets/icons without the extension, e.g. "add-to-queue-icon". */
    name: string;
    /** Square size in px (number) or any CSS length (string). */
    size?: number | string;
  }>(),
  { size: 24 },
);

const markup = computed(() => icons[props.name] ?? "");
const dim = computed(() =>
  typeof props.size === "number" ? `${props.size}px` : props.size,
);
</script>

<template>
  <span
    class="app-icon"
    :style="{ width: dim, height: dim }"
    v-html="markup"
  />
</template>

<style scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}
.app-icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
