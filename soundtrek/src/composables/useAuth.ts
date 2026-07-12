import { ref, computed } from "vue";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const user = ref<User | null>(null);
const authLoading = ref(true);

if (!import.meta.env.SSR) {
  supabase.auth.getSession().then(({ data }) => {
    user.value = data.session?.user ?? null;
    authLoading.value = false;
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null;
    authLoading.value = false;
  });
}

export function useAuth() {
  const displayName = computed(
    () => (user.value?.user_metadata?.display_name as string | undefined) ?? null,
  );

  const isAdmin = computed(
    () => (user.value?.app_metadata?.role as string | undefined) === "admin",
  );

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, name?: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: name ? { data: { display_name: name } } : undefined,
    });
    if (error) throw error;
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/discover` },
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  async function updateDisplayName(name: string) {
    const { error, data } = await supabase.auth.updateUser({
      data: { display_name: name },
    });
    if (error) throw error;
    user.value = data.user;
  }

  async function deleteAccount() {
    const { error } = await supabase.rpc("delete_own_account");
    if (error) throw error;
    user.value = null;
  }

  return {
    user,
    authLoading,
    displayName,
    isAdmin,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    sendPasswordReset,
    updatePassword,
    updateDisplayName,
    deleteAccount,
  };
}
