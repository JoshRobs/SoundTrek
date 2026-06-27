<script setup lang="ts">
import { useHead } from "@unhead/vue";
import termsHtml from "@/assets/terms-and-conditions.html?raw";

useHead({
  title: "Terms of Service | SoundTrek",
  meta: [
    { name: "description", content: "Terms of service for SoundTrek." },
    { property: "og:title", content: "Terms of Service | SoundTrek" },
    { property: "og:url", content: "https://soundtrek.app/terms-of-service" },
  ],
});
</script>

<template>
  <div class="terms-page">
    <div class="terms-inner" v-html="termsHtml" />
  </div>
</template>

<style scoped>
.terms-page {
  padding: 3rem 2rem 5rem;
}

.terms-inner {
  max-width: 760px;
  margin: 0 auto;
}

.terms-inner :deep(*) {
  background: transparent !important;
  font-family: inherit !important;
}

.terms-inner :deep([data-custom-class="title"]),
.terms-inner :deep([data-custom-class="title"] *) {
  font-size: 2rem !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  margin-bottom: 0.5rem !important;
}

.terms-inner :deep([data-custom-class="subtitle"]),
.terms-inner :deep([data-custom-class="subtitle"] *) {
  font-size: 0.85rem !important;
  color: var(--text-muted) !important;
  margin-bottom: 2rem !important;
}

.terms-inner :deep([data-custom-class="heading_1"]),
.terms-inner :deep([data-custom-class="heading_1"] *) {
  font-size: 1.2rem !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  margin-top: 2rem !important;
  display: block !important;
}

.terms-inner :deep([data-custom-class="heading_2"]),
.terms-inner :deep([data-custom-class="heading_2"] *) {
  font-size: 1rem !important;
  font-weight: 600 !important;
  color: var(--text-primary) !important;
  margin-top: 1.25rem !important;
  display: block !important;
}

.terms-inner :deep([data-custom-class="body_text"]),
.terms-inner :deep([data-custom-class="body_text"] *) {
  color: var(--text-secondary) !important;
  font-size: 0.9rem !important;
  line-height: 1.7 !important;
}

.terms-inner :deep([data-custom-class="link"]),
.terms-inner :deep([data-custom-class="link"] *) {
  color: var(--accent) !important;
  font-size: 0.9rem !important;
  word-break: break-word !important;
  text-decoration: none !important;
}

.terms-inner :deep([data-custom-class="link"]:hover) {
  text-decoration: underline !important;
}

.terms-inner :deep(ul),
.terms-inner :deep(ol) {
  padding-left: 1.5rem;
  color: var(--text-secondary);
}

.terms-inner :deep(li) {
  line-height: 1.7;
  font-size: 0.9rem;
}

.terms-inner :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.terms-inner :deep(th),
.terms-inner :deep(td) {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  color: var(--text-secondary) !important;
  text-align: left;
}

.terms-inner :deep(th) {
  color: var(--text-primary) !important;
  background: var(--surface-2) !important;
}

@media (max-width: 768px) {
  .terms-page {
    padding: 2rem 1.25rem 4rem;
  }
}
</style>
