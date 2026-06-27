<script setup lang="ts">
import { useHead } from "@unhead/vue";
import privacyHtml from "@/assets/privacy-policy.html?raw";

useHead({
  title: "Privacy Policy | SoundTrek",
  meta: [
    { name: "description", content: "Privacy policy for SoundTrek." },
    { property: "og:title", content: "Privacy Policy | SoundTrek" },
    { property: "og:url", content: "https://soundtrek.app/privacy" },
  ],
});
</script>

<template>
  <div class="privacy-page">
    <div class="privacy-inner" v-html="privacyHtml" />
  </div>
</template>

<style scoped>
.privacy-page {
  padding: 3rem 2rem 5rem;
}

.privacy-inner {
  max-width: 760px;
  margin: 0 auto;
}

/* Override Termly's hardcoded light-mode colors with site theme */
.privacy-inner :deep(*) {
  background: transparent !important;
  font-family: inherit !important;
}

.privacy-inner :deep([data-custom-class="title"]),
.privacy-inner :deep([data-custom-class="title"] *) {
  font-size: 2rem !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  margin-bottom: 0.5rem !important;
}

.privacy-inner :deep([data-custom-class="subtitle"]),
.privacy-inner :deep([data-custom-class="subtitle"] *) {
  font-size: 0.85rem !important;
  color: var(--text-muted) !important;
  margin-bottom: 2rem !important;
}

.privacy-inner :deep([data-custom-class="heading_1"]),
.privacy-inner :deep([data-custom-class="heading_1"] *) {
  font-size: 1.2rem !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  margin-top: 2rem !important;
  display: block !important;
}

.privacy-inner :deep([data-custom-class="heading_2"]),
.privacy-inner :deep([data-custom-class="heading_2"] *) {
  font-size: 1rem !important;
  font-weight: 600 !important;
  color: var(--text-primary) !important;
  margin-top: 1.25rem !important;
  display: block !important;
}

.privacy-inner :deep([data-custom-class="body_text"]),
.privacy-inner :deep([data-custom-class="body_text"] *) {
  color: var(--text-secondary) !important;
  font-size: 0.9rem !important;
  line-height: 1.7 !important;
}

.privacy-inner :deep([data-custom-class="link"]),
.privacy-inner :deep([data-custom-class="link"] *) {
  color: var(--accent) !important;
  font-size: 0.9rem !important;
  word-break: break-word !important;
  text-decoration: none !important;
}

.privacy-inner :deep([data-custom-class="link"]:hover) {
  text-decoration: underline !important;
}

.privacy-inner :deep(ul),
.privacy-inner :deep(ol) {
  padding-left: 1.5rem;
  color: var(--text-secondary);
}

.privacy-inner :deep(li) {
  line-height: 1.7;
  font-size: 0.9rem;
}

.privacy-inner :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.privacy-inner :deep(th),
.privacy-inner :deep(td) {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  color: var(--text-secondary) !important;
  text-align: left;
}

.privacy-inner :deep(th) {
  color: var(--text-primary) !important;
  background: var(--surface-2) !important;
}

@media (max-width: 768px) {
  .privacy-page {
    padding: 2rem 1.25rem 4rem;
  }
}
</style>
