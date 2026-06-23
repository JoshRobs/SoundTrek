<script setup lang="ts">
import { ref, computed } from "vue";
import { RouterLink } from "vue-router";
import type { Soundtrack } from "@/types/soundtrack";
import CardInfoSheet from "./CardInfoSheet.vue";
import { toSlug } from "@/utils/slug";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { useLikes } from "@/composables/useLikes";

const props = defineProps<{ soundtrack: Soundtrack }>();
defineEmits<{ next: [] }>();

const store = useSoundtrackStore();
const showSheet = ref(false);
const { isLiked, toggleLike: rawToggle } = useLikes();

function toggleLike() {
  const delta = rawToggle(props.soundtrack.id);
  store.likeSoundtrack(props.soundtrack.id, delta);
}

function getConsoleSticker(console: string): string | null {
  const c = console.toLowerCase();
  if (c.includes("xbox")) return "/stickers/xbox.png";
  if (c.includes("playstation") || /ps\s?[1-5]/.test(c))
    return "/stickers/playstation.png";
  if (c.includes("gamecube")) return "/stickers/gamecube.png";
  if (c.includes("nintendo 64") || c.includes("n64"))
    return "/stickers/n64.png";
  if (c.includes("super nintendo") || c.includes("snes"))
    return "/stickers/snes.png";
  if (c.includes("nes") || c.includes("famicom")) return "/stickers/nes.png";
  if (c.includes("switch")) return "/stickers/switch.png";
  if (c.includes("wii u")) return "/stickers/wiiu.png";
  if (c.includes("wii")) return "/stickers/wii.png";
  if (c.includes("game boy") || c.includes("gameboy"))
    return "/stickers/gameboy.png";
  if (c.includes("3ds")) return "/stickers/3ds.png";
  if (c.includes("dreamcast")) return "/stickers/dreamcast.png";
  if (c.includes("saturn")) return "/stickers/saturn.png";
  if (c.includes("genesis") || c.includes("mega drive"))
    return "/stickers/genesis.png";
  if (c.includes("psp")) return "/stickers/psp.png";
  if (c.includes("vita")) return "/stickers/vita.png";
  if (c.includes("pc") || c.includes("windows")) return "/stickers/pc.png";
  if (c.includes("atari")) return "/stickers/atari.png";
  if (c.includes("arcade")) return "/stickers/arcade.png";
  return null;
}

function getConsoleColor(console: string): string {
  const c = console.toLowerCase();
  if (c.includes("xbox")) return "#107C10";
  if (c.includes("playstation") || /ps\s?[1-5]/.test(c)) return "#003087";
  if (c.includes("gamecube")) return "#4A4A4A";
  if (c.includes("nintendo 64") || c.includes("n64")) return "#CE181E";
  if (c.includes("super nintendo") || c.includes("snes")) return "#171717";
  if (c.includes("nes") || c.includes("famicom")) return "#CE181E";
  if (c.includes("switch")) return "#E4000F";
  if (c.includes("wii u")) return "#ffffff";
  if (c.includes("wii")) return "#C0C0C0";
  if (c.includes("game boy") || c.includes("gameboy")) return "#4A7A3A";
  if (c.includes("3ds")) return "#CC0000";
  if (c.includes("dreamcast")) return "#FF6600";
  if (c.includes("saturn")) return "#3D3D3D";
  if (c.includes("genesis") || c.includes("mega drive")) return "#1A1A8C";
  if (c.includes("psp") || c.includes("vita")) return "#1C1C6E";
  if (
    c.includes("pc") ||
    c.includes("windows") ||
    c.includes("mac") ||
    c.includes("linux")
  )
    return "#B0B0B0";
  if (c.includes("atari")) return "#D4621A";
  if (c.includes("arcade")) return "#FF0080";
  return "#ffffff";
}

const consoleColor = computed(() =>
  getConsoleColor(props.soundtrack.console ?? ""),
);

const consoleSticker = computed(() =>
  getConsoleSticker(props.soundtrack.console ?? ""),
);
</script>

<template>
  <div class="card">
    <div class="cover-3d" :style="{ '--console-color': consoleColor }">
      <div class="cover-frame">
        <div class="cover-wrap" @click="store.setNowPlaying(props.soundtrack)">
          <img
            v-if="soundtrack.cover_image_url"
            :src="soundtrack.cover_image_url"
            :alt="soundtrack.game_title"
            class="cover-img"
          />
          <div v-else class="cover-fallback">🎮</div>

          <div class="play-overlay">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>


        </div>

        <img
          v-if="consoleSticker"
          :src="consoleSticker"
          :alt="soundtrack.console"
          class="console-sticker"
        />
      </div>
    </div>

    <div class="bottom-bar">
      <div class="title-row">
        <div class="title-group">
          <RouterLink :to="`/soundtrack/${soundtrack.id}`" class="game-title-link">
            <h1 class="game-title">{{ soundtrack.game_title }}</h1>
          </RouterLink>
          <span class="composers">
            <RouterLink
              v-for="c in soundtrack.composers"
              :key="c"
              :to="`/composer/${toSlug(c)}`"
              class="composer-link"
              @click.stop
            >{{ c }}</RouterLink>
          </span>
        </div>
        <button
          class="like-btn"
          :class="{ liked: isLiked(props.soundtrack.id) }"
          :aria-label="isLiked(props.soundtrack.id) ? 'Unlike' : 'Like'"
          @click="toggleLike"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="icon icon-tabler icons-tabler-outline icon-tabler-heart"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path
              d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"
            />
          </svg>
          <span class="like-tooltip"
            >{{ soundtrack.likes }} others liked this OST</span
          >
        </button>
      </div>
      <div class="btn-row">
        <button class="info-btn" @click="showSheet = true">
          More info
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button class="next-btn" @click="$emit('next')">
          Next
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>

    <CardInfoSheet
      v-model:open="showSheet"
      :soundtrack="soundtrack"
      @next="$emit('next')"
    />
  </div>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 450px;
  max-width: 450px;
  background: transparent;
  gap: 1rem;
}


.cover-frame {
  position: relative;
  z-index: 1;
  border-radius: 8px;
  border-top: 15px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 15px solid transparent;
  background:
    linear-gradient(var(--bg, #0b0b12), var(--bg, #0b0b12)) padding-box,
    linear-gradient(
        145deg,
        color-mix(in srgb, var(--console-color, #fff) 95%, white) 0%,
        color-mix(in srgb, var(--console-color, #fff) 60%, var(--bg, #0b0b12))
          30%,
        color-mix(in srgb, var(--console-color, #fff) 60%, var(--bg, #0b0b12))
          50%,
        color-mix(in srgb, var(--console-color, #fff) 60%, var(--bg, #0b0b12))
          70%,
        color-mix(in srgb, var(--console-color, #fff) 90%, white) 100%
      )
      border-box;
  transform: translate(6px, 6px);
  transition: transform 0.35s ease;
}

.cover-frame:hover {
  transform: translate(0, 0);
}

.cover-3d {
  position: relative;
}

.cover-3d::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 2px solid
    color-mix(in srgb, var(--console-color, #fff) 20%, var(--bg, #0b0b12));
  border-radius: 8px;
  transform: translate(12px, 9px);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cover-3d::after {
  content: "";
  position: absolute;
  inset: 0;
  border: 2px solid
    color-mix(in srgb, var(--console-color, #fff) 40%, var(--bg, #0b0b12));
  border-radius: 8px;
  transform: translate(7px, 5px);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cover-3d:hover::before,
.cover-3d:hover::after {
  opacity: 1;
}

.cover-wrap {
  position: relative;
  overflow: hidden;
  background: var(--surface-2);
  cursor: pointer;
  border-radius: 0px;
}

.cover-wrap:hover .play-overlay {
  opacity: 1;
}

.console-sticker {
  position: absolute;
  top: 0px;
  left: 0;
  width: auto;
  height: auto;
  max-width: 140px;
  max-height: 80px;
  z-index: 2;
  pointer-events: none;
  opacity: 0.9;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  opacity: 0;
  transition: opacity 0.18s;
}

.cover-img {
  width: 100%;
  height: auto;
  max-height: 600px;
  object-fit: cover;
  object-position: center top;
  display: block;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
  color: var(--text-muted);
}


.bottom-bar {
  flex-shrink: 0;
  padding: 0.9rem 1rem 1rem;
  background: transparent;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-group {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.like-btn {
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.7rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #f5686c;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.1s;
  z-index: 10;
}

.like-btn:hover {
  background: rgba(224, 53, 59, 0.1);
}

.like-btn.liked svg {
  fill: #f5686c;
}

.like-btn:active {
  transform: scale(0.88);
}

.like-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 20, 20, 0.92);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
}

.like-btn:hover .like-tooltip {
  opacity: 1;
}

.game-title-link {
  text-decoration: none;
  color: inherit;
}

.game-title-link:hover .game-title {
  color: var(--accent-light);
}

.game-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.7rem;
  font-weight: 400;
  letter-spacing: 0.04em;
  line-height: 1;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


.composers {
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.3rem;
  margin: 0;
  font-size: 0.78rem;
  overflow: hidden;
}

.composer-link {
  color: var(--text-secondary);
  white-space: nowrap;
  text-decoration: none;
  transition: color 0.15s;
}

.composer-link + .composer-link::before {
  content: ", ";
  color: var(--text-muted);
}

.composer-link:hover {
  color: var(--accent);
}

.btn-row {
  display: flex;
  gap: 0.5rem;
}

.info-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.8rem;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.15s,
    color 0.15s;
}

.info-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.next-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 0.8rem;
  border-radius: 7px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    transform 0.1s;
}

.next-btn:hover {
  background: var(--accent-hover);
}
.next-btn:active {
  transform: scale(0.97);
}
</style>
