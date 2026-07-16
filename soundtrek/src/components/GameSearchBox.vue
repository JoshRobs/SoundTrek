<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { useComposerStore } from "@/stores/composers";
import { toSlug } from "@/utils/slug";
import type { Soundtrack } from "@/types/soundtrack";

const props = withDefaults(
  defineProps<{ autofocus?: boolean; compact?: boolean }>(),
  {
    autofocus: true,
    compact: false,
  },
);
const emit = defineEmits<{
  select: [
    result:
      | { type: "soundtrack"; id: string }
      | { type: "composer"; slug: string },
  ];
}>();

const router = useRouter();
const store = useSoundtrackStore();
const { allSoundtracks } = storeToRefs(store);
const composerStore = useComposerStore();
const { cache: composerCache } = storeToRefs(composerStore);

const query = ref("");
const focused = ref(false);   // controls focus-ring styling only
const dropdownOpen = ref(false);
const activeIdx = ref(-1);
const inputEl = ref<HTMLInputElement>();
const searchWrapEl = ref<HTMLElement>();

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

type SearchResult =
  | { kind: "soundtrack"; s: Soundtrack }
  | { kind: "composer"; name: string; slug: string; count: number };

function titleScore(title: string, q: string): number {
  const t = normalize(title);
  if (t === q) return 4;                                   // exact match
  if (t.startsWith(q + ' ') || t === q) return 3;         // starts with query
  if (t.split(' ').some((w) => w === q)) return 2;        // a word is exact match
  if (t.startsWith(q)) return 1;                          // title starts with query (no space boundary)
  return 0;                                                // just contains
}

const results = computed<SearchResult[]>(() => {
  const q = normalize(query.value.trim());
  if (!q) return [];

  const titleMatches: { result: SearchResult; score: number }[] = [];
  const composerGameMatches: SearchResult[] = [];
  const composerEntities = new Map<string, { name: string; count: number }>();

  for (const s of allSoundtracks.value) {
    if (normalize(s.game_title).includes(q)) {
      titleMatches.push({
        result: { kind: "soundtrack", s },
        score: titleScore(s.game_title, q),
      });
    } else if (
      (s.composers ?? []).some((c) => normalize(c).includes(q)) ||
      normalize(s.studio).includes(q)
    ) {
      composerGameMatches.push({ kind: "soundtrack", s });
    }

    for (const c of s.composers ?? []) {
      if (!normalize(c).includes(q)) continue;
      const slug = toSlug(c);
      const existing = composerEntities.get(slug);
      if (existing) existing.count++;
      else composerEntities.set(slug, { name: c, count: 1 });
    }
  }

  const sortedTitleMatches = titleMatches
    .sort((a, b) => b.score - a.score)
    .map((m) => m.result);

  const composerResults: SearchResult[] = [...composerEntities.entries()].map(
    ([slug, { name, count }]) => ({ kind: "composer", name, slug, count }),
  );

  return [...sortedTitleMatches, ...composerResults, ...composerGameMatches].slice(0, 8);
});

const showDropdown = computed(() => dropdownOpen.value && results.value.length > 0);

watch(query, () => {
  activeIdx.value = -1;
});

// Fetch profile images for composer results as they appear in the dropdown
watch(
  results,
  (list) => {
    for (const r of list) {
      if (r.kind === "composer") composerStore.fetchComposer(r.slug);
    }
  },
  { immediate: true },
);

function select(r: SearchResult) {
  query.value = "";
  dropdownOpen.value = false;
  if (r.kind === "composer") emit("select", { type: "composer", slug: r.slug });
  else emit("select", { type: "soundtrack", id: r.s.slug ?? r.s.id });
}

function onKeydown(e: KeyboardEvent) {
  if (!showDropdown.value) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIdx.value = Math.min(activeIdx.value + 1, results.value.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIdx.value = Math.max(activeIdx.value - 1, -1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (activeIdx.value >= 0) {
      select(results.value[activeIdx.value]);
    } else if (query.value.trim()) {
      dropdownOpen.value = false;
      router.push(`/search?q=${encodeURIComponent(query.value.trim())}`);
      query.value = "";
    }
  } else if (e.key === "Escape") {
    dropdownOpen.value = false;
    activeIdx.value = -1;
  }
}

function goToSearch() {
  if (!query.value.trim()) return;
  dropdownOpen.value = false;
  router.push(`/search?q=${encodeURIComponent(query.value.trim())}`);
  query.value = "";
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

function onFocus() {
  focused.value = true;
  dropdownOpen.value = true;
  store.loadAll(); // no-op once already loaded/hydrated — fires on first real interaction
}

onMounted(() => {
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
      <button class="search-icon-btn" aria-label="Search" @mousedown.prevent @click="goToSearch">
        <svg
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
      </button>
      <input
        ref="inputEl"
        v-model="query"
        class="search-input"
        type="text"
        placeholder="Search games or composers…"
        autocomplete="off"
        spellcheck="false"
        @focus="onFocus"
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
          :key="r.kind === 'composer' ? `composer-${r.slug}` : r.s.id"
          class="dropdown-item"
          :class="{ active: i === activeIdx }"
          role="option"
          @mousedown.prevent
          @click="select(r)"
        >
          <template v-if="r.kind === 'composer'">
            <div class="item-thumb item-thumb--composer">
              <img
                v-if="composerCache.get(r.slug)?.image_url"
                :src="composerCache.get(r.slug)!.image_url!"
                :alt="r.name"
              />
              <svg
                v-else
                class="thumb-fallback thumb-fallback--composer"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                />
              </svg>
            </div>
            <div class="item-info">
              <span class="item-title">{{ r.name }}</span>
              <span class="item-meta">Composer · {{ r.count }} {{ r.count === 1 ? 'soundtrack' : 'soundtracks' }}</span>
            </div>
          </template>
          <template v-else>
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
          </template>
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

.search-icon-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s;
}

.search-icon-btn:hover {
  color: var(--text-primary);
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

.item-thumb--composer {
  border-radius: 50%;
}

.thumb-fallback--composer {
  color: var(--text-muted);
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
