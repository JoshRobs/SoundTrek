<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { RouterLink } from "vue-router";
import { useHead } from "@unhead/vue";
import { supabase, SOUNDTRACK_LIST_COLUMNS } from "@/lib/supabase";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { useLikes } from "@/composables/useLikes";
import { useAuth } from "@/composables/useAuth";
import { useQueueActions } from "@/composables/useQueueActions";
import PageHero from "@/components/PageHero.vue";
import AppIcon from "@/components/AppIcon.vue";
import type { Soundtrack } from "@/types/soundtrack";

const store = useSoundtrackStore();
const { likedIds, likedOrder } = useLikes();
const { user } = useAuth();

const { addSoundtrack } = useQueueActions();
const queuedIds = ref(new Set<string>());
function addToQueue(s: Soundtrack) {
  addSoundtrack(s);
  queuedIds.value.add(s.id);
  setTimeout(() => queuedIds.value.delete(s.id), 1500);
}

const likedSoundtracksRaw = ref<Soundtrack[]>([]);
const loading = ref(true);

watch(
  likedIds,
  async (ids) => {
    if (ids.size === 0) {
      likedSoundtracksRaw.value = [];
      loading.value = false;
      return;
    }
    loading.value = true;
    const { data } = await supabase
      .from("soundtracks")
      .select(SOUNDTRACK_LIST_COLUMNS)
      .in("id", Array.from(ids));
    likedSoundtracksRaw.value = (data ?? []) as Soundtrack[];
    loading.value = false;
  },
  { immediate: true },
);

const coverColors = ref<Record<string, string>>({});

function extractCoverColor(img: HTMLImageElement, id: string) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 50, 50);
    const { data } = ctx.getImageData(0, 0, 50, 50);
    let r = 0,
      g = 0,
      b = 0,
      count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (!count) return;
    const nr = r / count / 255,
      ng = g / count / 255,
      nb = b / count / 255;
    const max = Math.max(nr, ng, nb),
      min = Math.min(nr, ng, nb),
      d = max - min;
    let h = 0;
    if (d > 0) {
      if (max === nr) h = ((ng - nb) / d + 6) % 6;
      else if (max === ng) h = (nb - nr) / d + 2;
      else h = (nr - ng) / d + 4;
      h = h / 6;
    }
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    coverColors.value[id] =
      `hsl(${Math.round(h * 360)}, ${Math.round(Math.min(1, s * 2.5) * 100)}%, 60%)`;
  } catch {
    /* cross-origin — falls back to accent */
  }
}

useHead({
  title: "Liked | SoundTrek",
  meta: [
    { name: "description", content: "Your liked soundtracks on SoundTrek." },
  ],
});

type SortKey =
  | "recent"
  | "release-desc"
  | "release-asc"
  | "title"
  | "studio"
  | "theme";
const sortBy = ref<SortKey>("recent");

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently Added" },
  { value: "release-desc", label: "Release Date" },
  { value: "title", label: "Title A–Z" },
  { value: "studio", label: "Studio" },
  { value: "theme", label: "Theme" },
];

function handleSortClick(value: SortKey) {
  if (value === "release-desc" && sortBy.value === "release-desc") {
    sortBy.value = "release-asc";
  } else if (value === "release-desc" && sortBy.value === "release-asc") {
    sortBy.value = "release-desc";
  } else {
    sortBy.value = value;
  }
}

const likedSoundtracks = computed(() => {
  const liked = likedSoundtracksRaw.value;
  switch (sortBy.value) {
    case "recent": {
      const idx = new Map(likedOrder.value.map((id, i) => [id, i]));
      return [...liked].sort(
        (a, b) => (idx.get(a.id) ?? 9999) - (idx.get(b.id) ?? 9999),
      );
    }
    case "release-desc":
      return [...liked].sort(
        (a, b) => (b.release_year ?? 0) - (a.release_year ?? 0),
      );
    case "release-asc":
      return [...liked].sort(
        (a, b) => (a.release_year ?? 0) - (b.release_year ?? 0),
      );
    case "title":
      return [...liked].sort((a, b) =>
        a.game_title.localeCompare(b.game_title),
      );
    case "studio":
      return [...liked].sort((a, b) => a.studio.localeCompare(b.studio));
    case "theme":
      return [...liked].sort((a, b) => {
        const ta = a.theme_tags?.[0] ?? "￿";
        const tb = b.theme_tags?.[0] ?? "￿";
        return ta.localeCompare(tb);
      });
  }
});
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero
        label="Library"
        title="Liked"
        subtitle="Soundtracks you've liked"
      />

      <div v-if="!user" class="sync-banner">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>
          <RouterLink to="/login" class="sign-in-link"
            >Create an account</RouterLink
          >
          to sync across devices.
        </span>
      </div>

      <div v-if="likedSoundtracks?.length" class="sort-bar">
        <button
          v-for="opt in sortOptions"
          :key="opt.value"
          class="sort-pill"
          :class="{
            active:
              sortBy === opt.value ||
              (opt.value === 'release-desc' && sortBy === 'release-asc'),
          }"
          @click="handleSortClick(opt.value)"
        >
          {{ opt.label }}
          <template
            v-if="
              opt.value === 'release-desc' &&
              (sortBy === 'release-desc' || sortBy === 'release-asc')
            "
          >
            {{ sortBy === "release-desc" ? "↓" : "↑" }}
          </template>
        </button>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner" />
        <span>Loading…</span>
      </div>

      <div v-else-if="likedSoundtracks.length" class="grid">
        <div v-for="s in likedSoundtracks" :key="s.id" class="card">
          <RouterLink
            :to="`/soundtrack/${s.slug ?? s.id}`"
            class="cover"
            :style="
              coverColors[s.id] ? { '--cover-color': coverColors[s.id] } : {}
            "
          >
            <img
              v-if="s.cover_image_url"
              :src="s.cover_image_url"
              :alt="s.game_title"
              crossorigin="anonymous"
              @load="extractCoverColor($event.target as HTMLImageElement, s.id)"
            />
            <span v-else class="cover-fallback">🎮</span>
            <span class="cover-scrim" aria-hidden="true" />
            <button
              class="queue-btn"
              :class="{ queued: queuedIds.has(s.id) }"
              :aria-label="
                queuedIds.has(s.id) ? 'Added to queue' : 'Add to queue'
              "
              @click.prevent.stop="addToQueue(s)"
            >
              <AppIcon v-if="queuedIds.has(s.id)" name="check-icon" :size="20" />
              <AppIcon v-else name="add-to-queue-icon" :size="20" />
            </button>
            <button
              class="play-btn-overlay"
              :aria-label="`Play ${s.game_title}`"
              @click.prevent.stop="store.setNowPlaying(s)"
            >
              <AppIcon name="play-icon" :size="40" />
            </button>
          </RouterLink>
          <div class="card-info">
            <RouterLink
              :to="`/soundtrack/${s.slug ?? s.id}`"
              class="card-title-link"
            >
              <p class="card-title">{{ s.game_title }}</p>
            </RouterLink>
            <p class="card-composer">
              {{
                (s.composers ?? []).length ? s.composers!.join(", ") : s.studio
              }}
            </p>
            <p v-if="(s.composers ?? []).length" class="card-studio">
              {{ s.studio }}
            </p>
          </div>
        </div>
      </div>

      <div v-else class="empty">
        <p>No liked soundtracks yet.</p>
        <p class="empty-sub">
          Like soundtracks using the
          <AppIcon
            name="heart-outline-icon"
            :size="13"
            style="vertical-align: -2px"
          />
          button on any soundtrack page.
        </p>
        <RouterLink to="/discover" class="browse-link"
          >Browse soundtracks</RouterLink
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
}

.page-inner {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 4rem;
}

.sync-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 1rem;
  margin-bottom: 1.75rem;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.82rem;
}

.sign-in-link {
  color: var(--accent);
  text-decoration: none;
}

.sign-in-link:hover {
  text-decoration: underline;
}

/* ── Sort bar ─────────────────────────────────────────────────────────────── */
.sort-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.sort-pill {
  padding: 0.35rem 0.85rem;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s,
    border-color 0.12s;
}

.sort-pill:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.sort-pill.active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  color: var(--accent-light, var(--accent));
}

/* ── Grid ─────────────────────────────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem;
}

@media (max-width: 960px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
  }
}

@media (max-width: 360px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
.card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.cover {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0px 40px rgba(0, 0, 0, 0.55);
  transition: box-shadow 0.5s ease;
}

.cover:hover {
  box-shadow:
    0 0 0 2px
      color-mix(in srgb, var(--cover-color, var(--accent)) 75%, transparent),
    0 0px 40px
      color-mix(in srgb, var(--cover-color, #000) 25%, rgba(0, 0, 0, 0.75));
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.cover:hover img {
  transform: scale(1.04);
}

.cover-fallback {
  font-size: 2.5rem;
}

/* Full-cover darkening scrim (non-interactive — clicks pass through to the
   cover link) that fades in on hover, mirroring the soundtrack page. */
.cover-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.cover:hover .cover-scrim {
  opacity: 1;
}

/* Add-to-queue button, top-right of the cover. */
.queue-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.18s ease,
    background 0.15s,
    color 0.15s,
    transform 0.15s;
}

.cover:hover .queue-btn {
  opacity: 1;
}

.queue-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.12);
}

.queue-btn.queued {
  opacity: 1;
  color: #1db954;
}

/* Circular play button centered over the scrim; clicking it plays, clicking
   the rest of the cover still navigates. */
.play-btn-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.85);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    background 0.15s;
}

.cover:hover .play-btn-overlay {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

/* Qualified with .cover:hover so it out-specifies the `.cover:hover
   .play-btn-overlay` rule above (which would otherwise pin the scale to 1). */
.cover:hover .play-btn-overlay:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: translate(-50%, -50%) scale(1.08);
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0 0.1rem;
}

.card-title-link {
  text-decoration: none;
  color: inherit;
}

.card-title-link:hover .card-title {
  color: var(--accent-light, var(--accent));
}

.card-title {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.5rem;
  letter-spacing: 0.03em;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s;
}

.card-composer {
  margin: 0;
  font-size: 1rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-studio {
  margin: 0;
  font-size: 1rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Loading ──────────────────────────────────────────────────────────────── */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* ── Empty ────────────────────────────────────────────────────────────────── */
.empty {
  padding: 4rem 0;
  text-align: center;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.empty p {
  margin: 0;
  font-size: 0.95rem;
}

.empty-sub {
  font-size: 0.85rem !important;
}

.browse-link {
  margin-top: 1rem;
  display: inline-block;
  padding: 0.55rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-decoration: none;
  transition:
    background 0.15s,
    color 0.15s;
}

.browse-link:hover {
  background: var(--surface-3, var(--surface-2));
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .page-inner {
    padding: 0 1rem 5rem;
  }

  .sort-bar {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 0.25rem;
    margin-bottom: 1.25rem;
    -webkit-overflow-scrolling: touch;
  }

  .sort-bar::-webkit-scrollbar {
    display: none;
  }

  .sort-pill {
    flex-shrink: 0;
  }

  .card-title {
    font-size: 1.05rem;
  }

  .card-composer,
  .card-studio {
    font-size: 0.8rem;
  }
}

/* Touch devices have no hover — keep the play button visible (and at full
   size) but skip the permanent scrim so covers aren't darkened. */
@media (hover: none) {
  .play-btn-overlay {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    background: rgba(0, 0, 0, 0.45);
    width: 48px;
    height: 48px;
  }

  .queue-btn {
    opacity: 1;
  }

  .cover img {
    transition: none;
  }
}
</style>
