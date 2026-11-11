<script setup lang="ts">
// The resolved-title line under a link field (see useLinkCheck).
import type { Resolved } from "@/composables/useLinkCheck";

defineProps<{ result: Resolved }>();
</script>

<template>
  <p class="resolved" :class="`resolved--${result.status}`">
    <template v-if="result.status === 'ok'">{{ result.title }}</template>
    <template v-else-if="result.status === 'error'">{{ result.error }}</template>
    <template v-else-if="result.status === 'loading'">Checking…</template>
    <template v-else>Not set</template>
  </p>
</template>

<style scoped>
.resolved {
  margin: 0;
  font-size: 0.8rem;
  padding: 0.4rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.resolved--ok {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
}

.resolved--error {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

.resolved--loading,
.resolved--empty {
  color: var(--text-muted);
}
</style>
