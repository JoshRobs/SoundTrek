<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { getSpotifyIFrameAPI } from "@/lib/spotifyEmbedApi";

const props = defineProps<{ spotifyType: string; spotifyId: string }>();
const emit = defineEmits<{ "playback-update": [isPaused: boolean] }>();

const containerRef = ref<HTMLDivElement | null>(null);
let controller: any = null;

async function init() {
  const container = containerRef.value;
  if (!container) return;
  controller = null;
  const api = await getSpotifyIFrameAPI();
  if (!containerRef.value) return; // unmounted while waiting
  api.createController(
    container,
    { uri: `spotify:${props.spotifyType}:${props.spotifyId}` },
    (ctrl: any) => {
      controller = ctrl;
      ctrl.addListener("playback_update", (e: any) => {
        emit("playback-update", e.data.isPaused);
      });
    },
  );
}

// Use loadUri for track changes — avoids tearing down the SDK's DOM
watch(
  () => [props.spotifyType, props.spotifyId] as const,
  ([type, id]) => {
    if (controller) controller.loadUri(`spotify:${type}:${id}`);
    else init();
  },
);

onMounted(init);

function play() { controller?.play(); }
function pause() { controller?.pause(); }
function reload() { init(); }

defineExpose({ play, pause, reload });
</script>

<template>
  <!-- Outer div is Vue's component root — never touched by the SDK.
       The SDK replaces the inner div with its iframe, leaving the root stable. -->
  <div style="width: 100%; height: 100%; overflow: hidden">
    <div ref="containerRef" style="width: 100%; height: 100%" />
  </div>
</template>

<style scoped>
/* Override the fixed px dimensions the Spotify SDK sets on its injected iframe */
:deep(iframe) {
  width: 100% !important;
  height: 100% !important;
  display: block;
}
</style>
