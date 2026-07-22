<script setup lang="ts">
import { ref } from "vue";
import type { Soundtrack } from "@/types/soundtrack";
import { useQueueActions } from "@/composables/useQueueActions";
import { useAuth } from "@/composables/useAuth";
import AppIcon from "@/components/AppIcon.vue";
import AddToCollectionModal from "@/components/AddToCollectionModal.vue";

const props = defineProps<{ soundtrack: Soundtrack; showInfo?: boolean }>();
defineEmits<{ click: []; play: [] }>();

const { addSoundtrack } = useQueueActions();
const { user } = useAuth();
const queued = ref(false);
const showAddToCollection = ref(false);
function addToQueue() {
  addSoundtrack(props.soundtrack);
  queued.value = true;
  setTimeout(() => (queued.value = false), 1500);
}
</script>

<template>
  <div
    class="cover-card"
    :class="{ 'cover-card--with-info': showInfo }"
    role="button"
    tabindex="0"
    @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <div class="cover-wrap">
      <img
        v-if="soundtrack.cover_image_url"
        :src="soundtrack.cover_image_url"
        :alt="soundtrack.game_title"
        class="cover-img"
      />
      <div v-else class="cover-fallback">🎮</div>

      <div class="cover-actions">
        <button
          v-if="user"
          class="action-btn"
          aria-label="Add to collection"
          @click.stop="showAddToCollection = true"
        >
          <AppIcon name="plus-icon" :size="22" />
        </button>
        <button
          class="action-btn"
          :class="{ queued }"
          :aria-label="queued ? 'Added to queue' : 'Add to queue'"
          @click.stop="addToQueue"
        >
          <AppIcon v-if="queued" name="check-icon" :size="24" />
          <AppIcon v-else name="add-to-queue-icon" :size="24" />
        </button>
      </div>

      <div class="cover-overlay">
        <button class="overlay-play" @click.stop="$emit('play')">
          <AppIcon name="play-icon" :size="24" />
        </button>
        <span class="cover-title">{{ soundtrack.game_title }}</span>
      </div>
    </div>
    <div v-if="showInfo" class="card-info">
      <p class="card-title">{{ soundtrack.game_title }}</p>
      <p class="card-meta">
        <span v-if="soundtrack.composers?.length">{{
          soundtrack.composers.join(", ")
        }}</span>
        <span>{{ soundtrack.release_year }}</span>
      </p>
    </div>

    <AddToCollectionModal
      :open="showAddToCollection"
      :soundtrack-id="soundtrack.id"
      :soundtrack-title="soundtrack.game_title"
      :cover-image="soundtrack.cover_image_url"
      @close="showAddToCollection = false"
    />
  </div>
</template>

<style scoped>
.cover-card {
  position: relative;
  border: none;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
  cursor: pointer;
  padding: 0;
  display: block;
  width: 100%;
  text-align: left;
  transition:
    transform 0.18s,
    box-shadow 0.18s;
}

.cover-card:focus-visible {
  outline: 2px solid var(--accent-light, var(--accent));
  outline-offset: 2px;
}

.cover-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
}

.cover-card:hover .cover-overlay {
  opacity: 1;
}

.cover-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
}

.cover-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2;
  display: flex;
  gap: 0.4rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 7px;
  background: rgba(17, 17, 17, 0.75);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.18s,
    background 0.15s,
    color 0.15s,
    transform 0.15s;
}

.cover-card:hover .action-btn,
.action-btn:focus-visible {
  opacity: 1;
}

.action-btn:hover {
  background: rgba(40, 40, 40, 0.9);
  transform: scale(1.12);
}

.action-btn.queued {
  opacity: 1;
  color: #1db954;
}

/* Touch devices have no hover — keep the actions reachable and give them
   comfortable tap targets. */
@media (hover: none) {
  .action-btn {
    opacity: 1;
    width: 38px;
    height: 38px;
    -webkit-tap-highlight-color: transparent;
  }

  /* No hover scale on touch — provide tactile feedback on press instead. */
  .action-btn:active {
    transform: scale(0.9);
    background: rgba(40, 40, 40, 0.9);
  }
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  opacity: 0;
  transition: opacity 0.18s;
}

.cover-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.2;
  text-align: center;
}

.overlay-play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  cursor: pointer;
  padding-left: 6px;
  transition:
    background 0.15s,
    transform 0.15s;
}

.overlay-play:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.cover-card--with-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: left;
  background: transparent;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.card-title {
  margin: 0;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.03em;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s;
}

.card-title:hover {
  color: var(--accent-light, var(--accent));
}

.card-meta {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  gap: 0.4rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta span + span::before {
  content: "·";
  margin-right: 0.4rem;
  opacity: 0.4;
}

@media (max-width: 768px) {
  .card-title {
    font-size: 1.05rem;
  }
}
</style>
