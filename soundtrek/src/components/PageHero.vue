<script setup lang="ts">
defineProps<{
  label?: string;
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="hero">
    <p v-if="label" class="hero-label">{{ label }}</p>
    <h1 class="hero-title">{{ title }}</h1>
    <p v-if="subtitle" class="hero-subtitle">{{ subtitle }}</p>
  </div>
</template>

<style scoped>
.hero {
  padding: 2.5rem 0 2rem;
}

@media (max-width: 768px) {
  .hero {
    padding: 1.25rem 0 1rem;
  }
}

.hero-label {
  margin: 0 0 0.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
}

.hero-title {
  margin: 0 0 0.4rem;
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.5rem, 6vw, 3.5rem);
  font-weight: 400;
  letter-spacing: 0.04em;
  line-height: 1;
  color: var(--text-primary);
}

.hero-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
