<script setup lang="ts">
import { computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import AppHeader from "@/components/AppHeader.vue";
import PersistentPlayer from "@/components/PersistentPlayer.vue";
import MobileMiniPlayer from "@/components/MobileMiniPlayer.vue";
import QueuePanel from "@/components/QueuePanel.vue";
import { useIsMobile } from "@/composables/useIsMobile";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { usePlayerStore } from "@/stores/player";
import { useListens } from "@/composables/useListens";
import { supabase } from "@/lib/supabase";

const { isMobile } = useIsMobile();
const { nowPlaying } = storeToRefs(useSoundtrackStore());
const router = useRouter();
const route = useRoute();
const isAdmin = computed(() => !!route.meta.requiresAdmin);

// Site-wide head defaults. Views override any of these with their own
// useHead (later entries win), so a page that sets nothing still gets its own
// canonical/og:url rather than pointing at the homepage.
const SITE = "https://soundtrek.app";
const DEFAULT_DESCRIPTION = "Discover video game soundtracks - one at a time.";
const DEFAULT_IMAGE = `${SITE}/og-image.png`;
useHead(
  computed(() => {
    const path = route.path === "/" ? "/" : route.path.replace(/\/+$/, "");
    const url = `${SITE}${path}`;
    return {
      title: "SoundTrek | Discover Game OSTs",
      meta: [
        { name: "description", content: DEFAULT_DESCRIPTION },
        { property: "og:site_name", content: "SoundTrek" },
        { property: "og:type", content: "website" },
        { property: "og:title", content: "SoundTrek" },
        { property: "og:description", content: DEFAULT_DESCRIPTION },
        { property: "og:url", content: url },
        { property: "og:image", content: DEFAULT_IMAGE },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: DEFAULT_IMAGE },
      ],
      link: [{ rel: "canonical", href: url }],
    };
  }),
);

// Record a listen whenever the player moves to a new soundtrack — covers direct
// plays, per-track plays, and the queue advancing into a different OST.
const player = usePlayerStore();
const { recordListen } = useListens();
watch(
  () => player.nowPlaying?.id,
  (id) => {
    if (id) recordListen(id);
  },
);

// Browser only: during prerender this would add a listener to the shared
// Supabase client for every page rendered, keeping each page's whole app (and
// its data) alive until the build runs out of memory.
if (!import.meta.env.SSR) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" && window.location.hash.includes("type=signup")) {
      router.push("/discover");
    }
  });
}
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
    <QueuePanel />
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
