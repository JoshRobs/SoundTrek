<script setup lang="ts">
import { RouterLink, useRouter, useRoute } from "vue-router";
import { useSoundtrackStore } from "@/stores/soundtracks";
import RandomizeHeaderButton from "./RandomizeHeaderButton.vue";
import ExploreMenu from "./ExploreMenu.vue";
import GameSearchBox from "./GameSearchBox.vue";

const router = useRouter();
const route = useRoute();
const store = useSoundtrackStore();

function onSearchSelect(id: string) {
  router.push(`/soundtrack/${id}`);
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
      <RandomizeHeaderButton @click="randomPick" />
    </div>
    <div class="header-center">
      <ExploreMenu />
      <RouterLink to="/catalog" class="nav-link">Catalog</RouterLink>
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
  gap: 40px;
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
  text-decoration: none;
  background: linear-gradient(
    to right,
    var(--accent) 50%,
    var(--text-primary) 50%
  );
  background-size: 200% 100%;
  background-position: right;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  transition: background-position 0.4s ease;
}

.logo:hover {
  background-position: left;
}

.nav-link {
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
  transition:
    color 0.15s,
    background 0.15s;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--text-primary);
  background: var(--surface-2);
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
