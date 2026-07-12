import { ref } from "vue";
import { defineStore } from "pinia";
import { supabase } from "@/lib/supabase";
import type { Collection, CollectionItem } from "@/types/collection";

export const useCollectionStore = defineStore("collections", () => {
  const myCollections = ref<Collection[]>([]);
  const loading = ref(false);

  async function fetchMyCollections() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    loading.value = true;
    const { data, error } = await supabase
      .from("collections")
      .select("*, collection_items(soundtrack_id, position, soundtrack:soundtracks(cover_image_url))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    loading.value = false;
    if (!error && data) myCollections.value = data as Collection[];
  }

  async function fetchCollection(id: string): Promise<Collection | null> {
    const { data, error } = await supabase
      .from("collections")
      .select(`
        *,
        collection_items (
          *,
          soundtrack:soundtracks(*)
        )
      `)
      .eq("id", id)
      .order("position", { referencedTable: "collection_items" })
      .single();
    if (error || !data) return null;
    return data as Collection;
  }

  async function createCollection(fields: {
    name: string;
    description?: string;
    is_public: boolean;
    theme_tags: string[];
  }): Promise<Collection | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const creator_name =
      (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Anonymous";
    const { data, error } = await supabase
      .from("collections")
      .insert({ ...fields, user_id: user.id, creator_name })
      .select()
      .single();
    if (error || !data) return null;
    myCollections.value.unshift(data as Collection);
    return data as Collection;
  }

  async function updateCollection(
    id: string,
    fields: Partial<Pick<Collection, "name" | "description" | "is_public" | "theme_tags">>,
  ): Promise<boolean> {
    const { error } = await supabase
      .from("collections")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      const c = myCollections.value.find((c) => c.id === id);
      if (c) Object.assign(c, fields);
    }
    return !error;
  }

  async function deleteCollection(id: string): Promise<boolean> {
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (!error) myCollections.value = myCollections.value.filter((c) => c.id !== id);
    return !error;
  }

  async function addToCollection(collectionId: string, soundtrackId: string): Promise<boolean> {
    const existing = await supabase
      .from("collection_items")
      .select("id")
      .eq("collection_id", collectionId)
      .eq("soundtrack_id", soundtrackId)
      .maybeSingle();
    if (existing.data) return true;

    const { data: items } = await supabase
      .from("collection_items")
      .select("position")
      .eq("collection_id", collectionId)
      .order("position", { ascending: false })
      .limit(1);
    const nextPosition = (items?.[0]?.position ?? -1) + 1;

    const { error } = await supabase.from("collection_items").insert({
      collection_id: collectionId,
      soundtrack_id: soundtrackId,
      position: nextPosition,
    });
    return !error;
  }

  async function removeFromCollection(collectionId: string, soundtrackId: string): Promise<boolean> {
    const { error } = await supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", collectionId)
      .eq("soundtrack_id", soundtrackId);
    return !error;
  }

  async function moveItem(collectionId: string, itemId: string, newPosition: number): Promise<boolean> {
    const { error } = await supabase
      .from("collection_items")
      .update({ position: newPosition })
      .eq("id", itemId);
    return !error;
  }

  async function getCollectionsContaining(soundtrackId: string): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("collection_items")
      .select("collection_id, collections!inner(user_id)")
      .eq("soundtrack_id", soundtrackId)
      .eq("collections.user_id", user.id);
    return (data ?? []).map((r: any) => r.collection_id as string);
  }

  return {
    myCollections,
    loading,
    fetchMyCollections,
    fetchCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    moveItem,
    getCollectionsContaining,
  };
});
