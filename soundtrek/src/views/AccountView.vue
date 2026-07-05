<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { useAuth } from "@/composables/useAuth";
import PageHero from "@/components/PageHero.vue";

useHead({ title: "Account | SoundTrek" });

const router = useRouter();
const {
  user,
  displayName,
  updateDisplayName,
  updatePassword,
  signOut,
  deleteAccount,
} = useAuth();

const nameInput = ref(displayName.value ?? "");
const nameSaving = ref(false);
const nameSaved = ref(false);
const nameError = ref("");

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const passwordSaving = ref(false);
const passwordSaved = ref(false);
const passwordError = ref("");

// Keep input in sync if user loads before auth resolves
watch(displayName, (val) => {
  if (val && !nameInput.value) nameInput.value = val;
});

async function saveName() {
  nameError.value = "";
  nameSaving.value = true;
  try {
    await updateDisplayName(nameInput.value.trim());
    nameSaved.value = true;
    setTimeout(() => (nameSaved.value = false), 2500);
  } catch (e) {
    nameError.value = e instanceof Error ? e.message : "Failed to update name";
  } finally {
    nameSaving.value = false;
  }
}

async function savePassword() {
  passwordError.value = "";
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = "Passwords do not match";
    return;
  }
  passwordSaving.value = true;
  try {
    await updatePassword(newPassword.value);
    passwordSaved.value = true;
    newPassword.value = "";
    confirmPassword.value = "";
    currentPassword.value = "";
    setTimeout(() => (passwordSaved.value = false), 2500);
  } catch (e) {
    passwordError.value =
      e instanceof Error ? e.message : "Failed to update password";
  } finally {
    passwordSaving.value = false;
  }
}

async function handleSignOut() {
  await signOut();
  router.push("/");
}

const isPasswordUser = computed(() => {
  const providers = user.value?.app_metadata?.providers as string[] | undefined;
  if (providers) return providers.includes("email");
  return user.value?.app_metadata?.provider === "email";
});

const confirmingDelete = ref(false);
const deleteError = ref("");
const deleting = ref(false);

async function handleDeleteAccount() {
  deleteError.value = "";
  deleting.value = true;
  try {
    await deleteAccount();
    router.push("/");
  } catch (e) {
    deleteError.value =
      e instanceof Error ? e.message : "Failed to delete account";
    confirmingDelete.value = false;
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <PageHero label="Settings" title="Account" />

      <div class="sections">
        <!-- Profile -->
        <section class="section">
          <h2 class="section-title">Profile</h2>
          <div class="field-row">
            <label class="field">
              <span class="label">Email</span>
              <input :value="user?.email" type="email" disabled class="input" />
            </label>
          </div>
          <form class="field-row" @submit.prevent="saveName">
            <label class="field">
              <span class="label">Display name</span>
              <input
                v-model="nameInput"
                type="text"
                autocomplete="name"
                class="input"
                placeholder="Your name"
                :disabled="nameSaving"
              />
            </label>
            <div v-if="nameError" class="error">{{ nameError }}</div>
            <div class="form-footer">
              <button class="save-btn" type="submit" :disabled="nameSaving">
                <span v-if="nameSaving" class="spinner-sm" />
                {{ nameSaved ? "Saved!" : "Save" }}
              </button>
            </div>
          </form>
        </section>

        <!-- Password (only for email/password accounts) -->
        <section v-if="isPasswordUser" class="section">
          <h2 class="section-title">Password</h2>
          <form class="field-row" @submit.prevent="savePassword">
            <label class="field">
              <span class="label">New password</span>
              <input
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                class="input"
                minlength="6"
                required
                :disabled="passwordSaving"
              />
            </label>
            <label class="field">
              <span class="label">Confirm new password</span>
              <input
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                class="input"
                minlength="6"
                required
                :disabled="passwordSaving"
              />
            </label>
            <div v-if="passwordError" class="error">{{ passwordError }}</div>
            <div class="form-footer">
              <button class="save-btn" type="submit" :disabled="passwordSaving">
                <span v-if="passwordSaving" class="spinner-sm" />
                {{ passwordSaved ? "Updated!" : "Update password" }}
              </button>
            </div>
          </form>
        </section>

        <!-- Danger zone -->
        <section class="section section--danger">
          <h2 class="section-title">Danger zone</h2>

          <button class="signout-btn" @click="handleSignOut">Sign out</button>

          <div class="divider" />

          <template v-if="!confirmingDelete">
            <div class="danger-row">
              <div>
                <p class="danger-label">Delete account</p>
                <p class="danger-sub">
                  Permanently removes your account and all saved data. This
                  cannot be undone.
                </p>
              </div>
              <button class="delete-btn" @click="confirmingDelete = true">
                Delete account
              </button>
            </div>
          </template>

          <template v-else>
            <div class="confirm-delete">
              <p class="confirm-msg">
                Are you sure? This will permanently delete your account, saved
                soundtracks, and likes.
              </p>
              <div v-if="deleteError" class="error">{{ deleteError }}</div>
              <div class="confirm-actions">
                <button
                  class="cancel-btn"
                  :disabled="deleting"
                  @click="confirmingDelete = false"
                >
                  Cancel
                </button>
                <button
                  class="delete-btn delete-btn--confirm"
                  :disabled="deleting"
                  @click="handleDeleteAccount"
                >
                  <span v-if="deleting" class="spinner-sm spinner-sm--red" />
                  Yes, delete my account
                </button>
              </div>
            </div>
          </template>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
}

.page-inner {
  max-width: 600px;
  margin: 0 auto;
  padding: 0 1.5rem 4rem;
}

.sections {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.section-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin: 0;
}

.field-row {
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

.input {
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.input:focus {
  border-color: var(--accent);
}
.input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.error {
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  background: rgba(245, 104, 108, 0.1);
  border: 1px solid rgba(245, 104, 108, 0.3);
  color: #f5686c;
  font-size: 0.85rem;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
}

.save-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.25rem;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.save-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}
.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.section--danger {
  border-color: rgba(245, 104, 108, 0.2);
}

.signout-btn {
  align-self: flex-start;
  padding: 0.55rem 1.25rem;
  border-radius: 8px;
  border: 1px solid rgba(245, 104, 108, 0.4);
  background: transparent;
  color: #f5686c;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.signout-btn:hover {
  background: rgba(245, 104, 108, 0.08);
  border-color: #f5686c;
}

.divider {
  height: 1px;
  background: rgba(245, 104, 108, 0.15);
}

.danger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.danger-label {
  margin: 0 0 0.2rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.danger-sub {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.delete-btn {
  flex-shrink: 0;
  padding: 0.55rem 1.25rem;
  border-radius: 8px;
  border: 1px solid rgba(245, 104, 108, 0.5);
  background: transparent;
  color: #f5686c;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
  white-space: nowrap;
}

.delete-btn:hover:not(:disabled) {
  background: rgba(245, 104, 108, 0.1);
  border-color: #f5686c;
}

.delete-btn--confirm {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(245, 104, 108, 0.12);
}

.delete-btn--confirm:hover:not(:disabled) {
  background: rgba(245, 104, 108, 0.22);
}

.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-delete {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.confirm-msg {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.cancel-btn {
  padding: 0.55rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.cancel-btn:hover:not(:disabled) {
  background: var(--surface-2);
}

.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner-sm--red {
  border-color: rgba(245, 104, 108, 0.3);
  border-top-color: #f5686c;
}

.spinner-sm {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .page-inner {
    padding: 0 1rem 5rem;
  }

  .section {
    padding: 1.1rem;
  }

  .sections {
    gap: 1.25rem;
  }

  /* Save button full-width on mobile */
  .form-footer {
    justify-content: stretch;
  }

  .save-btn {
    width: 100%;
    justify-content: center;
  }

  /* Danger row stacks instead of side-by-side */
  .danger-row {
    flex-direction: column;
    align-items: flex-start;
  }

  /* Confirm/cancel stack and go full-width */
  .confirm-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .cancel-btn,
  .delete-btn--confirm {
    width: 100%;
    justify-content: center;
  }
}
</style>
