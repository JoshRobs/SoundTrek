<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import PersistentPlayer from "@/components/PersistentPlayer.vue";
import MobileMiniPlayer from "@/components/MobileMiniPlayer.vue";
import { useIsMobile } from "@/composables/useIsMobile";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { supabase } from "@/lib/supabase";

const { isMobile } = useIsMobile();
const { nowPlaying } = storeToRefs(useSoundtrackStore());
const router = useRouter();
const route = useRoute();
const isAdmin = computed(() => !!route.meta.requiresAdmin);

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" && window.location.hash.includes("type=signup")) {
    router.push("/discover");
  }
});
</script>

<template>
  <!-- Admin routes render their own layout via nested RouterView -->
  <RouterView v-if="isAdmin" />

  <div v-else class="app-shell">
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
