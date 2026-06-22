<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useComposerStore } from "@/stores/composers";
import { toSlug } from "@/utils/slug";

const props = defineProps<{ composerName: string }>();

const store = useComposerStore();
const supportUrl = ref<string | null>(null);

async function load(name: string) {
  const composer = await store.fetchComposer(toSlug(name));
  supportUrl.value = composer?.support_url ?? null;
}

onMounted(() => load(props.composerName));
watch(() => props.composerName, load);
</script>

<template>
  <a
    v-if="supportUrl"
    :href="supportUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="support-btn"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
    Support {{ composerName }}
  </a>
</template>

<style scoped>
.support-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border-radius: 7px;
  border: 1px solid rgba(245, 104, 108, 0.35);
  background: rgba(245, 104, 108, 0.07);
  color: #f5686c;
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.support-btn:hover {
  background: rgba(245, 104, 108, 0.15);
  border-color: rgba(245, 104, 108, 0.6);
}

.support-btn svg {
  flex-shrink: 0;
  opacity: 0.8;
}
</style>
