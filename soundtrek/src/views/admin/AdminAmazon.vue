<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { supabase } from "@/lib/supabase";
import { useSoundtrackStore } from "@/stores/soundtracks";

const { allSoundtracks } = storeToRefs(useSoundtrackStore());

const PARTNER_TAG = import.meta.env.VITE_AMAZON_TAG as string | undefined;

// ── Queue: soundtracks with no amazon_url, most popular first ─────────────────
// Popularity order so the most-visited pages get their buy links first.

const skipped = ref(new Set<string>());

const queue = computed(() =>
  allSoundtracks.value
    .filter((s) => !s.amazon_url)
    .sort(
      (a, b) =>
        (b.total_likes ?? b.likes ?? 0) - (a.total_likes ?? a.likes ?? 0),
    ),
);

const selected = computed(
  () => queue.value.find((s) => !skipped.value.has(s.id)) ?? null,
);
const remaining = computed(
  () => queue.value.filter((s) => !skipped.value.has(s.id)).length,
);

function skip() {
  if (selected.value) skipped.value.add(selected.value.id);
}

// ── Editable fields ───────────────────────────────────────────────────────────

const amazonUrl = ref("");
const imageUrl = ref("");
const imgBroken = ref(false);

const saving = ref(false);
const saveError = ref<string | null>(null);
const savedNote = ref<string | null>(null);

watch(imageUrl, () => (imgBroken.value = false));

watch(
  selected,
  (s) => {
    amazonUrl.value = s?.amazon_url ?? "";
    imageUrl.value = s?.amazon_image_url ?? "";
    imgBroken.value = false;
    saveError.value = null;
  },
  { immediate: true },
);

// Pasted product URLs get normalized to the canonical affiliate form the
// enrich script produced: https://www.amazon.com/dp/{ASIN}?tag={PARTNER_TAG}.
// Strips tracking junk (ref=, qid=, sr=, th=1 …) in the process.
const ASIN_RE = /(?:\/dp\/|\/gp\/product\/|\/product\/)([A-Z0-9]{10})(?=[/?]|$)/i;

watch(amazonUrl, (raw) => {
  const match = raw.match(ASIN_RE);
  if (!match) return;
  const canonical = `https://www.amazon.com/dp/${match[1].toUpperCase()}${
    PARTNER_TAG ? `?tag=${PARTNER_TAG}` : ""
  }`;
  if (raw !== canonical) amazonUrl.value = canonical;
});

// ── Amazon search links ───────────────────────────────────────────────────────

const searchQuery = computed(() =>
  selected.value
    ? encodeURIComponent(`${selected.value.game_title} original soundtrack`)
    : "",
);
const musicSearchUrl = computed(() =>
  selected.value
    ? `https://www.amazon.com/s?k=${searchQuery.value}&i=music`
    : null,
);
const digitalSearchUrl = computed(() =>
  selected.value
    ? `https://www.amazon.com/s?k=${searchQuery.value}&i=digital-music`
    : null,
);
const allSearchUrl = computed(() =>
  selected.value ? `https://www.amazon.com/s?k=${searchQuery.value}` : null,
);

// ── Save ──────────────────────────────────────────────────────────────────────

async function save() {
  const s = selected.value;
  if (!s) return;
  saving.value = true;
  saveError.value = null;

  const fields = {
    amazon_url: amazonUrl.value.trim() || null,
    amazon_image_url: imageUrl.value.trim() || null,
  };

  const { error } = await supabase
    .from("soundtracks")
    .update(fields)
    .eq("id", s.id);

  saving.value = false;

  if (error) {
    saveError.value = error.message;
    return;
  }

  // Update the store row — with amazon_url set, it drops out of the queue
  // and the next soundtrack is selected automatically.
  const row = allSoundtracks.value.find((r) => r.id === s.id);
  if (row) Object.assign(row, fields);
  savedNote.value = `Saved ${s.game_title} — ${remaining.value} remaining`;
}
</script>

<template>
  <div class="page">
    <div class="queue-bar">
      <span class="queue-count">
        {{ remaining }} soundtrack{{ remaining !== 1 ? "s" : "" }} without an
        Amazon link
      </span>
      <span v-if="savedNote" class="saved-note">{{ savedNote }}</span>
      <button class="btn btn--ghost" :disabled="!selected" @click="skip">
        Skip →
      </button>
    </div>

    <template v-if="selected">
      <section class="card">
        <div class="card-header">
          <div class="track-ref">
            <img
              v-if="selected.cover_image_url"
              :src="selected.cover_image_url"
              :alt="selected.game_title"
              class="track-cover"
            />
            <div>
              <h2 class="card-title">{{ selected.game_title }}</h2>
              <p class="meta-note">
                {{
                  selected.composers?.length
                    ? selected.composers.join(", ")
                    : selected.studio
                }}
                · {{ selected.release_year }}
              </p>
            </div>
          </div>
          <div class="header-actions">
            <a
              v-if="musicSearchUrl"
              :href="musicSearchUrl"
              target="_blank"
              rel="noopener"
              class="btn btn--primary"
            >
              CDs & Vinyl ↗
            </a>
            <a
              v-if="digitalSearchUrl"
              :href="digitalSearchUrl"
              target="_blank"
              rel="noopener"
              class="btn btn--ghost"
            >
              Digital ↗
            </a>
            <a
              v-if="allSearchUrl"
              :href="allSearchUrl"
              target="_blank"
              rel="noopener"
              class="btn btn--ghost"
            >
              All ↗
            </a>
          </div>
        </div>

        <p class="hint-line">
          Find the OST on Amazon, paste the product URL below — it's cleaned
          into an affiliate link automatically. Then paste the product image URL
          (right-click the product photo → Copy image address).
        </p>

        <div class="preview-row">
          <div class="product-preview">
            <img
              v-if="imageUrl && !imgBroken"
              :src="imageUrl"
              :alt="selected.game_title"
              @error="imgBroken = true"
            />
            <span
              v-else-if="imgBroken"
              class="preview-fallback preview-fallback--broken"
            >
              image failed to load
            </span>
            <span v-else class="preview-fallback">no product image</span>
          </div>

          <div class="preview-fields">
            <label class="field">
              <span>
                Amazon product URL
                <a
                  v-if="amazonUrl"
                  :href="amazonUrl"
                  target="_blank"
                  rel="noopener"
                  class="open-link"
                  >Open ↗</a
                >
              </span>
              <input
                v-model="amazonUrl"
                type="text"
                spellcheck="false"
                placeholder="https://www.amazon.com/dp/…"
              />
            </label>
            <label class="field">
              <span>Product image URL</span>
              <input
                v-model="imageUrl"
                type="text"
                spellcheck="false"
                placeholder="https://m.media-amazon.com/images/I/…"
              />
            </label>
          </div>
        </div>

        <div class="save-row">
          <button
            class="btn btn--primary"
            :disabled="saving || !amazonUrl.trim()"
            @click="save"
          >
            {{ saving ? "Saving…" : "Save & Next" }}
          </button>
          <p v-if="saveError" class="msg msg--error">{{ saveError }}</p>
        </div>
      </section>
    </template>

    <p v-else class="hint">
      Every soundtrack has an Amazon link. Nothing to do 🎉
    </p>
  </div>
</template>

<style scoped>
.page {
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.queue-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 1rem;
}

.queue-count {
  font-size: 0.85rem;
  color: #ffffffbb;
}

.saved-note {
  font-size: 0.8rem;
  color: #4ade80;
  margin-left: auto;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.track-ref {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.track-cover {
  width: 56px;
  height: 74px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
  background: var(--surface-2);
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.meta-note {
  font-size: 0.78rem;
  color: #ffffffbb;
  margin: 0.2rem 0 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.hint-line {
  margin: 0;
  font-size: 0.8rem;
  color: #ffffff99;
}

/* Preview */
.preview-row {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}

.product-preview {
  flex-shrink: 0;
  width: 140px;
  height: 140px;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-fallback {
  font-size: 0.75rem;
  color: #00000077;
  text-align: center;
  padding: 0 0.75rem;
}

.preview-fallback--broken {
  color: #dc2626;
}

.preview-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.field input {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.45rem 0.65rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}

.field input:focus {
  outline: none;
  border-color: var(--accent);
}

.open-link {
  font-size: 0.75rem;
  color: var(--accent);
  text-decoration: none;
  margin-left: 0.4rem;
}

.open-link:hover {
  text-decoration: underline;
}

/* Buttons */
.btn {
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--accent);
  color: #fff;
}

.btn--ghost {
  background: var(--surface-2);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn--ghost:hover:not(:disabled) {
  color: var(--text-primary);
}

.save-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.msg {
  font-size: 0.82rem;
  margin: 0;
  padding: 0.5rem 0.8rem;
  border-radius: 6px;
}

.msg--error {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.hint {
  font-size: 0.875rem;
  color: #ffffffbb;
}
</style>
