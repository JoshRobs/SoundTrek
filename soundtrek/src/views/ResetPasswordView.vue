<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { supabase } from "@/lib/supabase";

useHead({ title: "Reset Password | SoundTrek" });

const router = useRouter();
const password = ref("");
const confirm = ref("");
const errorMsg = ref("");
const loading = ref(false);
const ready = ref(false);
const done = ref(false);

onMounted(() => {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") ready.value = true;
  });
  // Already in a recovery session if user arrived via the email link
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) ready.value = true;
  });
});

async function submit() {
  if (password.value !== confirm.value) {
    errorMsg.value = "Passwords do not match";
    return;
  }
  errorMsg.value = "";
  loading.value = true;
  try {
    const { error } = await supabase.auth.updateUser({ password: password.value });
    if (error) throw error;
    done.value = true;
    setTimeout(() => router.push("/discover"), 2000);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : "Something went wrong";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <div class="brand">SoundTrek</div>
      <p class="tagline">Set a new password</p>

      <div v-if="done" class="success-msg">
        Password updated. Redirecting you now…
      </div>

      <form v-else class="form" @submit.prevent="submit">
        <label class="field">
          <span class="label">New password</span>
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
            minlength="6"
            :disabled="loading"
          />
        </label>
        <label class="field">
          <span class="label">Confirm password</span>
          <input
            v-model="confirm"
            type="password"
            autocomplete="new-password"
            required
            minlength="6"
            :disabled="loading"
          />
        </label>

        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

        <button class="submit-btn" type="submit" :disabled="loading || !ready">
          <span v-if="loading" class="spinner-sm" />
          Update password
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.card {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.brand {
  font-family: "Bebas Neue", sans-serif;
  font-size: 2rem;
  letter-spacing: 0.06em;
  background: linear-gradient(to right, var(--accent), var(--text-primary));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.tagline {
  margin: -0.5rem 0 0;
  font-size: 1rem;
  color: var(--text-muted);
}

.success-msg {
  padding: 1rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
}

.form {
  display: flex;
  flex-direction: column;
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

.field input {
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
}

.field input:focus { border-color: var(--accent); }
.field input:disabled { opacity: 0.5; }

.error {
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  background: rgba(245, 104, 108, 0.1);
  border: 1px solid rgba(245, 104, 108, 0.3);
  color: #f5686c;
  font-size: 0.85rem;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.submit-btn:hover:not(:disabled) { background: var(--accent-hover); }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
