<script setup lang="ts">
import { ref, computed } from "vue";
import { useHead } from "@unhead/vue";
import { useRouter } from "vue-router";
import { supabase } from "@/lib/supabase";

const router = useRouter();

useHead({
  title: "Contact | SoundTrek",
  meta: [
    {
      name: "description",
      content: "Get in touch with the SoundTrek team. Send us feedback, questions, or suggestions.",
    },
  ],
});

const name = ref("");
const email = ref("");
const message = ref("");
const state = ref<"idle" | "submitting" | "success" | "error">("idle");
const errorMsg = ref("");

const canSubmit = computed(
  () => email.value.trim().length > 0 && message.value.trim().length > 0
);

async function submit() {
  if (!canSubmit.value || state.value === "submitting") return;
  state.value = "submitting";
  errorMsg.value = "";

  const payload: Record<string, string> = {
    email: email.value.trim(),
    message: message.value.trim(),
  };
  if (name.value.trim()) payload.name = name.value.trim();

  const { error } = await supabase.from("contact_messages").insert(payload);

  if (error) {
    errorMsg.value = "Something went wrong. Please try again.";
    state.value = "error";
  } else {
    state.value = "success";
  }
}

function reset() {
  name.value = "";
  email.value = "";
  message.value = "";
  state.value = "idle";
}
</script>

<template>
  <div class="contact-page">
    <div class="contact-inner">
      <button class="back-btn" @click="router.back()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back
      </button>

      <div class="page-header">
        <p class="page-label">Get in touch</p>
        <h1 class="page-title">Contact Us</h1>
        <p class="page-sub">
          Have feedback, a question, or just want to say hello? We'd love to
          hear from you.
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
        <h2 class="success-title">Message sent!</h2>
        <p class="success-sub">Thanks for reaching out. We'll get back to you soon.</p>
        <button class="btn-primary" @click="reset">Send another</button>
      </div>

      <form v-else class="form" @submit.prevent="submit">
        <div class="field-row">
          <div class="field">
            <label class="label" for="name">
              Name <span class="label-optional">(optional)</span>
            </label>
            <input
              id="name"
              v-model="name"
              class="input"
              type="text"
              placeholder="Your name"
              autocomplete="name"
            />
          </div>
          <div class="field">
            <label class="label" for="email">Email</label>
            <input
              id="email"
              v-model="email"
              class="input"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              autofocus
            />
          </div>
        </div>

        <div class="field">
          <label class="label" for="message">Message</label>
          <textarea
            id="message"
            v-model="message"
            class="input textarea"
            placeholder="What's on your mind?"
            rows="6"
          />
        </div>

        <div v-if="state === 'error'" class="error-banner">{{ errorMsg }}</div>

        <button
          type="submit"
          class="btn-primary"
          :disabled="!canSubmit || state === 'submitting'"
        >
          {{ state === "submitting" ? "Sending…" : "Send message" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.contact-page {
  padding: 3rem 2rem 6rem;
}

.contact-inner {
  max-width: 800px;
  margin: 0 auto;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 1.75rem;
  padding: 0.4rem 0.75rem 0.4rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.back-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
  background: var(--surface);
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

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
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

.label-optional {
  font-weight: 400;
  opacity: 0.6;
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
  min-height: 120px;
  line-height: 1.5;
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

@media (max-width: 768px) {
  .contact-page {
    padding: 2rem 1.25rem 4rem;
  }

  .field-row {
    grid-template-columns: 1fr;
  }

  .input {
    font-size: 1rem;
  }
}
</style>
