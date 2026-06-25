<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { useRouter } from "vue-router";

useHead({
  title: "404 Not Found | SoundTrek",
  meta: [
    { name: "description", content: "Page not found." },
  ],
});

const router = useRouter();
</script>

<template>
  <div class="not-found-page">
    <div class="not-found-inner">
      <p class="page-label">Error 404</p>
      <h1 class="page-title">Page Not Found</h1>
      <p class="page-sub">The page you're looking for doesn't exist or has been moved.</p>
      <button class="btn-primary" @click="router.push('/')">Go Home</button>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 3rem 2rem;
}

.not-found-inner {
  max-width: 480px;
  text-align: center;
}

.page-label {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.page-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  font-weight: 400;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
  line-height: 1;
}

.page-sub {
  margin: 0 0 2rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.btn-primary {
  padding: 0.65rem 1.75rem;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

@media (max-width: 768px) {
  .not-found-page {
    padding: 3rem 1.25rem;
  }
}
</style>
