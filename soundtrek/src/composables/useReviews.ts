import { ref, computed, watch } from "vue";
import type { Ref } from "vue";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export interface Review {
  id: string;
  soundtrack_id: string;
  user_id: string;
  display_name: string;
  rating: number;
  body: string | null;
  created_at: string;
  updated_at: string;
}

export function useReviews(soundtrackId: Ref<string | null>) {
  const { user } = useAuth();
  const reviews = ref<Review[]>([]);
  const loading = ref(false);
  const submitting = ref(false);
  const error = ref<string | null>(null);

  async function fetch(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const { data, error: err } = await supabase
        .from("reviews")
        .select("*")
        .eq("soundtrack_id", id)
        .order("created_at", { ascending: false });
      if (err) throw err;
      reviews.value = data ?? [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load reviews";
    } finally {
      loading.value = false;
    }
  }

  watch(
    soundtrackId,
    (id) => {
      if (id) fetch(id);
      else reviews.value = [];
    },
    { immediate: true },
  );

  const userReview = computed(() => {
    if (!user.value) return null;
    return reviews.value.find((r) => r.user_id === user.value!.id) ?? null;
  });

  const averageRating = computed(() => {
    if (!reviews.value.length) return 0;
    return (
      reviews.value.reduce((sum, r) => sum + r.rating, 0) / reviews.value.length
    );
  });

  async function submitReview(rating: number, body: string) {
    if (!user.value || !soundtrackId.value) return;
    submitting.value = true;
    error.value = null;
    try {
      const displayName =
        (user.value.user_metadata?.display_name as string | undefined) ??
        user.value.email?.split("@")[0] ??
        "Anonymous";

      const { data, error: err } = await supabase
        .from("reviews")
        .upsert(
          {
            soundtrack_id: soundtrackId.value,
            user_id: user.value.id,
            display_name: displayName,
            rating,
            body: body.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,soundtrack_id" },
        )
        .select()
        .single();

      if (err) throw err;

      const idx = reviews.value.findIndex((r) => r.user_id === user.value!.id);
      if (idx >= 0) reviews.value[idx] = data;
      else reviews.value = [data, ...reviews.value];
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to submit review";
      throw e;
    } finally {
      submitting.value = false;
    }
  }

  async function deleteReview() {
    if (!user.value || !soundtrackId.value) return;
    submitting.value = true;
    error.value = null;
    try {
      const { error: err } = await supabase
        .from("reviews")
        .delete()
        .eq("user_id", user.value.id)
        .eq("soundtrack_id", soundtrackId.value);
      if (err) throw err;
      reviews.value = reviews.value.filter(
        (r) => r.user_id !== user.value!.id,
      );
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to delete review";
      throw e;
    } finally {
      submitting.value = false;
    }
  }

  return {
    reviews,
    loading,
    submitting,
    error,
    userReview,
    averageRating,
    submitReview,
    deleteReview,
  };
}
