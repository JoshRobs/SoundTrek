<script setup lang="ts">
import { ref, computed } from "vue";
import { RouterLink } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import { useReviews } from "@/composables/useReviews";
import StarRating from "./StarRating.vue";

const props = defineProps<{ soundtrackId: string | null }>();

const { user } = useAuth();
const soundtrackIdRef = computed(() => props.soundtrackId);

const {
  reviews,
  userReview,
  averageRating,
  submitting,
  loading,
  submitReview,
  deleteReview,
} = useReviews(soundtrackIdRef);

const rating = ref(0);
const body = ref("");
const editing = ref(false);
const error = ref("");

function startEdit() {
  rating.value = userReview.value?.rating ?? 0;
  body.value = userReview.value?.body ?? "";
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  rating.value = 0;
  body.value = "";
  error.value = "";
}

async function handleSubmit() {
  error.value = "";
  if (!rating.value) {
    error.value = "Please select a star rating.";
    return;
  }
  try {
    await submitReview(rating.value, body.value);
    editing.value = false;
    rating.value = 0;
    body.value = "";
  } catch {
    error.value = "Failed to submit review. Please try again.";
  }
}

async function handleDelete() {
  try {
    await deleteReview();
  } catch {
    error.value = "Failed to delete review.";
  }
}

function formatDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
</script>

<template>
  <div class="reviews">
    <!-- Header -->
    <div class="reviews-header">
      <h2 class="reviews-heading">Reviews</h2>
      <div v-if="reviews.length" class="reviews-summary">
        <StarRating :model-value="averageRating" :readonly="true" :small="true" />
        <span class="reviews-avg">{{ Math.round(averageRating) }}<span class="reviews-out-of">/100</span></span>
        <span class="reviews-count">
          {{ reviews.length }} {{ reviews.length === 1 ? "review" : "reviews" }}
        </span>
      </div>
    </div>

    <!-- Write / edit form (signed in) -->
    <div v-if="user" class="form-card">
      <template v-if="!userReview || editing">
        <p class="form-heading">{{ editing ? "Edit your review" : "Write a review" }}</p>
        <div class="rating-row">
          <StarRating v-model="rating" />
          <input
            v-model.number="rating"
            type="number"
            min="1"
            max="100"
            class="rating-input"
            @change="rating = Math.min(100, Math.max(1, rating || 1))"
          />
          <span class="rating-denom">/100</span>
        </div>
        <textarea
          v-model="body"
          class="review-textarea"
          placeholder="Share your thoughts about this soundtrack… (optional)"
          maxlength="1000"
          rows="4"
        />
        <div class="form-footer">
          <span class="char-count">{{ body.length }}/1000</span>
          <div class="form-actions">
            <button v-if="editing" class="btn-cancel" @click="cancelEdit">Cancel</button>
            <button
              class="btn-submit"
              :disabled="rating === 0 || submitting"
              @click="handleSubmit"
            >
              {{ submitting ? "Saving…" : editing ? "Update" : "Post review" }}
            </button>
          </div>
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
      </template>

      <!-- Existing review -->
      <template v-else>
        <div class="own-review-header">
          <StarRating :model-value="userReview.rating" :readonly="true" :small="true" />
          <span class="own-review-label">Your review</span>
          <button class="btn-edit" @click="startEdit">Edit</button>
          <button class="btn-delete" :disabled="submitting" @click="handleDelete">Delete</button>
        </div>
        <p v-if="userReview.body" class="review-body">{{ userReview.body }}</p>
      </template>
    </div>

    <!-- Sign-in prompt (signed out) -->
    <p v-else class="signin-prompt">
      <RouterLink to="/login" class="signin-link">Sign in</RouterLink>
      to leave a review.
    </p>

    <!-- Review list -->
    <div v-if="loading" class="reviews-status">Loading reviews…</div>

    <ul v-else-if="reviews.length" class="review-list">
      <li v-for="r in reviews" :key="r.id" class="review-item">
        <div class="review-item-header">
          <StarRating :model-value="r.rating" :readonly="true" :small="true" />
          <span class="review-score">{{ r.rating }}<span class="review-score-denom">/100</span></span>
          <span class="reviewer-name">{{ r.display_name }}</span>
          <span class="review-date">{{ formatDate(r.created_at) }}</span>
        </div>
        <p v-if="r.body" class="review-body">{{ r.body }}</p>
      </li>
    </ul>

    <p v-else-if="!loading" class="reviews-status">No reviews yet. Be the first!</p>
  </div>
</template>

<style scoped>
.reviews {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.reviews-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.reviews-heading {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  margin: 0;
}

.reviews-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reviews-avg {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.reviews-out-of {
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--text-muted);
}

.reviews-count {
  font-size: 0.82rem;
  color: var(--text-muted);
}

/* ── Form card ────────────────────────────────────────────────────────────── */
.form-card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.25rem;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.form-heading {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.rating-input {
  width: 52px;
  padding: 0.3rem 0.4rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-primary);
  font-size: 0.9rem;
  text-align: center;
  outline: none;
  transition: border-color 0.15s;
  /* hide number spinners */
  -moz-appearance: textfield;
}

.rating-input::-webkit-outer-spin-button,
.rating-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}

.rating-input:focus {
  border-color: var(--accent);
}

.rating-denom {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.review-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  outline: none;
  min-height: 90px;
  transition: border-color 0.15s;
}

.review-textarea:focus { border-color: var(--accent); }
.review-textarea::placeholder { color: var(--text-muted); }

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.char-count {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-submit {
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

.btn-submit:hover:not(:disabled) { background: var(--accent-hover); }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-cancel {
  padding: 0.55rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-cancel:hover { background: var(--surface-2); color: var(--text-secondary); }

.form-error {
  margin: 0;
  font-size: 0.82rem;
  color: #f5686c;
}

/* ── Own review ───────────────────────────────────────────────────────────── */
.own-review-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.own-review-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.btn-edit, .btn-delete {
  padding: 0.2rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.btn-edit { color: var(--text-secondary); }
.btn-edit:hover { background: var(--surface-2); color: var(--text-primary); }

.btn-delete { color: #f5686c; border-color: rgba(245, 104, 108, 0.3); }
.btn-delete:hover:not(:disabled) { background: rgba(245, 104, 108, 0.08); }
.btn-delete:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Sign-in prompt ───────────────────────────────────────────────────────── */
.signin-prompt {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.signin-link { color: var(--accent); text-decoration: none; }
.signin-link:hover { text-decoration: underline; }

/* ── Review list ──────────────────────────────────────────────────────────── */
.review-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.review-item {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1rem 0;
  border-top: 1px solid var(--border);
}

.review-item:last-child { border-bottom: 1px solid var(--border); }

.review-item-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.review-score {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.review-score-denom {
  font-size: 0.68rem;
  font-weight: 400;
  color: var(--text-muted);
}

.reviewer-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.review-date {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-left: auto;
}

.review-body {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.reviews-status {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .form-card {
    padding: 1rem;
  }

  /* Prevent iOS auto-zoom on input focus (requires font-size >= 16px) */
  .review-textarea,
  .rating-input {
    font-size: 1rem;
  }

  /* Stack footer: char count above, buttons full-width below */
  .form-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 0.65rem;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn-submit,
  .btn-cancel {
    width: 100%;
    justify-content: center;
    padding: 0.75rem;
  }

  /* Prevent date from pushing off narrow screens */
  .review-date {
    margin-left: 0;
    flex-basis: 100%;
  }
}
</style>
