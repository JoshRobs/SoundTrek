<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";

const props = withDefaults(
  defineProps<{ autofocus?: boolean; compact?: boolean }>(),
  {
    autofocus: true,
    compact: false,
  },
);
const emit = defineEmits<{ select: [id: string] }>();

const store = useSoundtrackStore();
const { allSoundtracks } = storeToRefs(store);

const query = ref("");
const focused = ref(false);   // controls focus-ring styling only
const dropdownOpen = ref(false);
const activeIdx = ref(-1);
const inputEl = ref<HTMLInputElement>();
const searchWrapEl = ref<HTMLElement>();

const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  const titleMatches: { s: typeof allSoundtracks.value[0]; by: 'title' | 'composer' }[] = [];
  const composerMatches: { s: typeof allSoundtracks.value[0]; by: 'title' | 'composer' }[] = [];
  for (const s of allSoundtracks.value) {
    if (s.game_title.toLowerCase().includes(q)) titleMatches.push({ s, by: 'title' });
    else if ((s.composers ?? []).some((c) => c.toLowerCase().includes(q)) || s.studio.toLowerCase().includes(q)) composerMatches.push({ s, by: 'composer' });
  }
  return [...titleMatches, ...composerMatches].slice(0, 8);
});

const showDropdown = computed(() => dropdownOpen.value && results.value.length > 0);

watch(query, () => {
  activeIdx.value = -1;
});

function select(id: string) {
  query.value = "";
  dropdownOpen.value = false;
  emit("select", id);
}

function onKeydown(e: KeyboardEvent) {
  if (!showDropdown.value) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIdx.value = Math.min(activeIdx.value + 1, results.value.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIdx.value = Math.max(activeIdx.value - 1, -1);
  } else if (e.key === "Enter" && activeIdx.value >= 0) {
    e.preventDefault();
    select(results.value[activeIdx.value].s.id);
  } else if (e.key === "Escape") {
    dropdownOpen.value = false;
    activeIdx.value = -1;
  }
}

function onBlur() {
  setTimeout(() => {
    focused.value = false;
    // intentionally leave dropdownOpen — iOS "Done" button triggers blur but
    // the user may still want to tap a result
  }, 150);
}

function onDocPointerdown(e: PointerEvent) {
  if (!searchWrapEl.value?.contains(e.target as Node)) {
    dropdownOpen.value = false;
    focused.value = false;
    activeIdx.value = -1;
  }
}

onMounted(() => {
  store.loadAll();
  if (props.autofocus) inputEl.value?.focus();
  document.addEventListener("pointerdown", onDocPointerdown);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocPointerdown);
});
</script>

<template>
  <div ref="searchWrapEl" class="search-wrap">
    <div class="search-box" :class="{ focused, compact }">
      <svg
        class="search-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        ref="inputEl"
        v-model="query"
        class="search-input"
        type="text"
        placeholder="Search games or composers…"
        autocomplete="off"
        spellcheck="false"
        @focus="focused = true; dropdownOpen = true"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <button
        v-if="query"
        class="clear-btn"
        @mousedown.prevent
        @click="
          query = '';
          inputEl?.focus();
        "
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <Transition name="dropdown">
      <ul v-if="showDropdown" class="dropdown" role="listbox">
        <li
          v-for="(r, i) in results"
          :key="r.s.id"
          class="dropdown-item"
          :class="{ active: i === activeIdx }"
          role="option"
          @mousedown.prevent
          @click="select(r.s.id)"
        >
          <div class="item-thumb">
            <img
              v-if="r.s.cover_image_url"
              :src="r.s.cover_image_url"
              :alt="r.s.game_title"
            />
            <span v-else class="thumb-fallback">🎮</span>
          </div>
          <div class="item-info">
            <span class="item-title">{{ r.s.game_title }}</span>
            <span class="item-meta">{{ r.s.composers.join(', ') || r.s.studio }} · {{ r.s.release_year }}</span>
          </div>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.search-wrap {
  position: relative;
  width: 100%;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0 1rem;
  height: 58px;
  border-radius: 14px;
  border: 1.5px solid var(--border);
  background: var(--card);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.search-box.focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

.search-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1rem;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: var(--surface-2);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.clear-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  list-style: none;
  margin: 0;
  padding: 0.3rem;
  z-index: 20;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s;
}

.dropdown-item:hover,
.dropdown-item.active {
  background: var(--surface-2);
}

.item-thumb {
  width: 56px;
  height: 56px;
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-fallback {
  font-size: 1.1rem;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.item-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  font-size: 0.92rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.search-box.compact {
  height: 38px;
  border-radius: 8px;
  padding: 0 0.65rem;
  gap: 0.4rem;
}

.search-box.compact .search-input {
  font-size: 0.85rem;
}

.search-box.compact .clear-btn {
  width: 16px;
  height: 16px;
  background: transparent;
  border-radius: 0;
  color: var(--text-muted);
  padding: 0;
}

.search-box.compact .clear-btn:hover {
  background: transparent;
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .search-box.compact .search-input {
    font-size: 1rem;
  }
}
</style>
