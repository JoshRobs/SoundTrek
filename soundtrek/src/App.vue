<script setup lang="ts">
import { storeToRefs } from "pinia";
import AppHeader from "@/components/AppHeader.vue";
import PersistentPlayer from "@/components/PersistentPlayer.vue";
import MobileMiniPlayer from "@/components/MobileMiniPlayer.vue";
import { useIsMobile } from "@/composables/useIsMobile";
import { useSoundtrackStore } from "@/stores/soundtracks";

const { isMobile } = useIsMobile();
const { nowPlaying } = storeToRefs(useSoundtrackStore());
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <div
      id="app-main"
      class="app-main"
      :class="{ 'has-mini-player': isMobile && nowPlaying }"
    >
      <RouterView v-slot="{ Component }">
        <KeepAlive include="TopView">
          <component :is="Component" :key="$route.fullPath" />
        </KeepAlive>
      </RouterView>
    </div>
    <PersistentPlayer v-if="!isMobile" />
    <MobileMiniPlayer v-else />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

.app-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.app-main.has-mini-player {
  padding-bottom: 72px;
}

@media print {
  .app-shell {
    height: auto;
  }
  .app-main {
    overflow: visible;
    min-height: unset;
  }
}
</style>
