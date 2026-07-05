<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useHead } from "@unhead/vue";
import { useAuth } from "@/composables/useAuth";

const router = useRouter();
const route = useRoute();
const { signIn, signUp, signInWithGoogle, sendPasswordReset } = useAuth();

const mode = ref<"auth" | "forgot">("auth");
const tab = ref<"signin" | "signup">("signin");
const email = ref("");
const password = ref("");
const displayName = ref("");
const errorMsg = ref("");
const loading = ref(false);
const signUpDone = ref(false);
const forgotSent = ref(false);

const redirect = (route.query.redirect as string) || "/discover";

onMounted(() => {
  const urlError = route.query.error_description as string | undefined
    ?? route.query.error as string | undefined;
  if (urlError) {
    const lower = urlError.toLowerCase();
    if (lower.includes("already registered") || lower.includes("already exists")) {
      errorMsg.value = "An account with this email already exists. Sign in with your password instead.";
    } else {
      errorMsg.value = urlError;
    }
  }
});

const pageTitle = computed(() => {
  if (mode.value === "forgot") return "Reset Password | SoundTrek";
  return tab.value === "signin" ? "Sign In | SoundTrek" : "Create Account | SoundTrek";
});

useHead(computed(() => ({ title: pageTitle.value })));

async function submit() {
  errorMsg.value = "";
  loading.value = true;
  try {
    if (tab.value === "signin") {
      await signIn(email.value, password.value);
      router.push(redirect);
    } else {
      await signUp(email.value, password.value, displayName.value.trim() || undefined);
      signUpDone.value = true;
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : "Something went wrong";
  } finally {
    loading.value = false;
  }
}

async function submitForgot() {
  errorMsg.value = "";
  loading.value = true;
  try {
    await sendPasswordReset(email.value);
    forgotSent.value = true;
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : "Something went wrong";
  } finally {
    loading.value = false;
  }
}

async function googleSignIn() {
  errorMsg.value = "";
  try {
    await signInWithGoogle();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
      errorMsg.value = "An account with this email already exists. Sign in with your password instead.";
      switchTab("signin");
    } else {
      errorMsg.value = msg || "Something went wrong";
    }
  }
}

function switchTab(t: "signin" | "signup") {
  tab.value = t;
  errorMsg.value = "";
  signUpDone.value = false;
}

function goForgot() {
  mode.value = "forgot";
  errorMsg.value = "";
  forgotSent.value = false;
}

function goBack() {
  mode.value = "auth";
  errorMsg.value = "";
  forgotSent.value = false;
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">SoundTrek</div>

      <!-- ── Forgot password ─────────────────────────────────────────────── -->
      <template v-if="mode === 'forgot'">
        <p class="tagline">Reset your password</p>

        <div v-if="forgotSent" class="success-msg">
          Check your email for a reset link. You can close this page.
        </div>

        <template v-else>
          <form class="form" @submit.prevent="submitForgot">
            <label class="field">
              <span class="label">Email</span>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                required
                :disabled="loading"
              />
            </label>

            <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

            <button class="submit-btn" type="submit" :disabled="loading">
              <span v-if="loading" class="spinner-sm" />
              Send reset email
            </button>
          </form>

          <button class="text-link" @click="goBack">← Back to sign in</button>
        </template>
      </template>

      <!-- ── Auth ───────────────────────────────────────────────────────── -->
      <template v-else>
        <p class="tagline">
          {{ tab === "signin" ? "Welcome back" : "Create your account" }}
        </p>

        <div v-if="signUpDone" class="success-msg">
          <strong>Almost there!</strong> Check your email and click the confirmation
          link to activate your account, then sign in.
        </div>

        <template v-else>
          <div class="tabs">
            <button
              class="tab-btn"
              :class="{ active: tab === 'signin' }"
              @click="switchTab('signin')"
            >Sign in</button>
            <button
              class="tab-btn"
              :class="{ active: tab === 'signup' }"
              @click="switchTab('signup')"
            >Sign up</button>
          </div>

          <button class="google-btn" :disabled="loading" @click="googleSignIn">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div class="divider"><span>or</span></div>

          <form class="form" @submit.prevent="submit">
            <label v-if="tab === 'signup'" class="field">
              <span class="label">Display name <span class="optional">(optional)</span></span>
              <input
                v-model="displayName"
                type="text"
                autocomplete="name"
                placeholder="How you'll appear on SoundTrek"
                :disabled="loading"
              />
            </label>
            <label class="field">
              <span class="label">Email</span>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                required
                :disabled="loading"
              />
            </label>
            <label class="field">
              <span class="label">Password</span>
              <input
                v-model="password"
                type="password"
                :autocomplete="tab === 'signin' ? 'current-password' : 'new-password'"
                required
                :disabled="loading"
                minlength="6"
              />
            </label>

            <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

            <button class="submit-btn" type="submit" :disabled="loading">
              <span v-if="loading" class="spinner-sm" />
              {{ tab === "signin" ? "Sign in" : "Create account" }}
            </button>

            <button
              v-if="tab === 'signin'"
              type="button"
              class="text-link"
              @click="goForgot"
            >Forgot your password?</button>
          </form>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.login-card {
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

.tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--surface-2);
  border-radius: 8px;
}

.tab-btn {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tab-btn.active {
  background: var(--bg);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.google-btn:hover:not(:disabled) {
  background: var(--surface-3, var(--surface-2));
  border-color: var(--text-muted);
}

.google-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
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

.optional {
  font-weight: 400;
  color: var(--text-muted);
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

.field input::placeholder {
  color: var(--text-muted);
}

.field input:focus {
  border-color: var(--accent);
}

.field input:disabled {
  opacity: 0.5;
}

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

.submit-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.text-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0;
  text-align: left;
  transition: color 0.15s;
}

.text-link:hover {
  color: var(--text-secondary);
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .login-page {
    align-items: flex-start;
    padding: 2rem 1.25rem 4rem;
  }

  /* Prevent iOS auto-zoom on input focus (requires font-size >= 16px) */
  .field input {
    font-size: 1rem;
  }

  .submit-btn {
    padding: 0.85rem;
  }
}
</style>
