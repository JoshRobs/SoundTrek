<script setup lang="ts">
import { RouterLink, useRouter, useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import ExploreMenu from "./ExploreMenu.vue";
import GameSearchBox from "./GameSearchBox.vue";

const router = useRouter();
const route = useRoute();
const store = useSoundtrackStore();
const { allSoundtracks } = storeToRefs(store);

function onSearchSelect(id: string) {
  const track = allSoundtracks.value.find((s) => s.id === id);
  if (track) store.setNowPlaying(track);
}

function randomPick() {
  store.nextSoundtrack();
  if (route.path !== "/discover") router.push("/discover");
}
</script>

<template>
  <header class="header">
    <div class="header-left">
      <RouterLink to="/" class="logo">SoundTrek</RouterLink>
    </div>
    <div class="header-center">
      <ExploreMenu />
      <button class="random-btn" @click="randomPick">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          />
        </svg>
        Random Pick
      </button>
    </div>
    <div id="header-right" class="header-right">
      <div class="header-search">
        <GameSearchBox
          :autofocus="false"
          :compact="true"
          @select="onSearchSelect"
        />
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  flex-shrink: 0;
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  z-index: 10;
  gap: 10px;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}

.logo {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.5rem;
  letter-spacing: 0.06em;
  color: var(--text-primary);
  text-decoration: none;
}

.random-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}

.random-btn:hover {
  color: var(--text-primary);
  background: var(--surface-2);
  border-color: var(--border);
}

.header-search {
  width: 300px;
}
</style>
