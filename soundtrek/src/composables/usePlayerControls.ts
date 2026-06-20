import { ref, watch, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";
import type { Soundtrack } from "@/types/soundtrack";

interface SpotifyEmbedControls {
  play: () => void;
  pause: () => void;
}

export function usePlayerControls(
  nowPlaying: Ref<Soundtrack | null>,
  activeSource: Ref<"youtube" | "spotify">,
  iframeRef: Ref<HTMLIFrameElement | null>,
  spotifyEmbedRef: Ref<SpotifyEmbedControls | null>,
) {
  const isPlaying = ref(false);
  const volume = ref(Number(localStorage.getItem("player-volume") || "100"));

  function sendYouTubeCommand(cmd: string, args: unknown[] = []) {
    iframeRef.value?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: cmd, args }),
      "https://www.youtube.com",
    );
  }

  function applyVolume() {
    sendYouTubeCommand("setVolume", [volume.value]);
  }

  function onWindowMessage(e: MessageEvent) {
    if (e.origin !== "https://www.youtube.com") return;
    try {
      const d = JSON.parse(e.data);
      if (d.event === "onReady") {
        applyVolume();
      }
      // YouTube state: 1=playing, 2=paused, 0=ended
      if (d.event === "onStateChange") isPlaying.value = d.info === 1;
    } catch {}
  }

  function togglePlay() {
    if (activeSource.value === "youtube") {
      if (isPlaying.value) {
        sendYouTubeCommand("pauseVideo");
        isPlaying.value = false;
      } else {
        sendYouTubeCommand("playVideo");
        isPlaying.value = true;
      }
    } else {
      if (isPlaying.value) spotifyEmbedRef.value?.pause();
      else spotifyEmbedRef.value?.play();
    }
  }

  function setSpotifyPlaying(isPaused: boolean) {
    if (activeSource.value === "spotify") isPlaying.value = !isPaused;
  }

  watch(volume, (v) => {
    localStorage.setItem("player-volume", String(v));
    applyVolume();
  });

  watch([nowPlaying, activeSource], () => { isPlaying.value = false; });

  onMounted(() => window.addEventListener("message", onWindowMessage));
  onUnmounted(() => window.removeEventListener("message", onWindowMessage));

  return { isPlaying, volume, togglePlay, setSpotifyPlaying };
}
