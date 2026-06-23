<script setup lang="ts">
import { ref, computed } from "vue";
import { useHead } from "@unhead/vue";
import { supabase } from "@/lib/supabase";

useHead({
  title: "Submit a Soundtrack | SoundTrek",
  meta: [
    {
      name: "description",
      content:
        "Submit a video game soundtrack to be added to the SoundTrek library.",
    },
  ],
});

const gameTitle = ref("");
const notes = ref("");
const state = ref<"idle" | "submitting" | "success" | "error">("idle");
const errorMsg = ref("");

const canSubmit = computed(() => gameTitle.value.trim().length > 0);

async function submit() {
  if (!canSubmit.value || state.value === "submitting") return;
  state.value = "submitting";
  errorMsg.value = "";

  const payload: Record<string, string> = { game_title: gameTitle.value.trim() };
  if (notes.value.trim()) payload.notes = notes.value.trim();

  const { error } = await supabase.from("submissions").insert(payload);

  if (error) {
    errorMsg.value = "Something went wrong. Please try again.";
    state.value = "error";
  } else {
    state.value = "success";
  }
}

function reset() {
  gameTitle.value = "";
  notes.value = "";
  state.value = "idle";
}
</script>

<template>
  <div class="submit-page">
    <div class="submit-inner">
      <div class="page-header">
        <p class="page-label">Community</p>
        <h1 class="page-title">Submit a Soundtrack</h1>
        <p class="page-sub">
          Know a great game OST that's missing from SoundTrek? Let us know and
          we'll look into adding it.
        </p>
      </div>

      <div v-if="state === 'success'" class="success-card">
        <div class="success-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 class="success-title">Thanks for the suggestion!</h2>
        <p class="success-sub">
          We'll look into adding <em>{{ gameTitle || "it" }}</em> to the
          library.
        </p>
        <button class="btn-primary" @click="reset">Submit another</button>
      </div>

      <form v-else class="form" @submit.prevent="submit">
        <div class="field">
          <label class="label" for="game_title">Game title</label>
          <input
            id="game_title"
            v-model="gameTitle"
            class="input"
            type="text"
            placeholder="e.g. Chrono Trigger"
            autocomplete="off"
            autofocus
          />
        </div>

        <div class="field">
          <label class="label" for="notes">Additional info <span class="label-optional">(optional)</span></label>
          <textarea
            id="notes"
            v-model="notes"
            class="input textarea"
            placeholder="Composer, platform, why it's worth adding, links, etc."
            rows="4"
          />
        </div>

        <div v-if="state === 'error'" class="error-banner">{{ errorMsg }}</div>

        <button
          type="submit"
          class="btn-primary"
          :disabled="!canSubmit || state === 'submitting'"
        >
          {{ state === "submitting" ? "Submitting…" : "Submit" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.submit-page {
  padding: 3rem 2rem 6rem;
}

.submit-inner {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2.5rem;
}

.page-label {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.page-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  font-weight: 400;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
  line-height: 1;
}

.page-sub {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ── Success ─────────────────────────────────────────────────────────── */
.success-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.success-card .btn-primary {
  align-self: center;
  gap: 1rem;
  padding: 3rem 2rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  text-align: center;
}

.success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent-3) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-3) 40%, transparent);
  color: var(--accent-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 2rem;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  margin: 0;
}

.success-sub {
  margin: 0;
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ── Form ────────────────────────────────────────────────────────────── */
.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.input {
  width: 100%;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.95rem;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: var(--accent);
}

.input::placeholder {
  color: var(--text-muted);
}

.textarea {
  resize: vertical;
  min-height: 90px;
  line-height: 1.5;
}

.label-optional {
  font-weight: 400;
  opacity: 0.6;
}

.btn-primary {
  align-self: flex-start;
  padding: 0.65rem 1.75rem;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.15s,
    opacity 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: default;
}

.error-banner {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: color-mix(in srgb, #f87171 10%, transparent);
  border: 1px solid color-mix(in srgb, #f87171 30%, transparent);
  color: #f87171;
  font-size: 0.85rem;
}
</style>
