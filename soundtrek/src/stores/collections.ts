import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { supabase, SOUNDTRACK_LIST_COLUMNS } from "@/lib/supabase";
import type { Collection } from "@/types/collection";

export const useCollectionStore = defineStore("collections", () => {
  const myCollections = ref<Collection[]>([]);
  const loading = ref(false);
  const publicCollections = ref<Collection[]>([]);
  const loadingPublic = ref(false);

  async function fetchPublicCollections() {
    loadingPublic.value = true;
    const { data, error } = await supabase
      .from("collections")
      .select("*, collection_items(soundtrack_id, video_id, position, soundtrack:soundtracks(cover_image_url))")
      .eq("is_public", true)
      .order("created_at", { ascending: false });
    loadingPublic.value = false;
    if (!error && data) publicCollections.value = data as Collection[];
  }

  async function fetchMyCollections() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    loading.value = true;
    const { data, error } = await supabase
      .from("collections")
      .select("*, collection_items(soundtrack_id, video_id, position, soundtrack:soundtracks(cover_image_url))")
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
          soundtrack:soundtracks(${SOUNDTRACK_LIST_COLUMNS})
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

  // Next position (append to end) for a collection.
  async function nextPosition(collectionId: string): Promise<number> {
    const { data: items } = await supabase
      .from("collection_items")
      .select("position")
      .eq("collection_id", collectionId)
      .order("position", { ascending: false })
      .limit(1);
    return (items?.[0]?.position ?? -1) + 1;
  }

  // Adds a whole soundtrack (album item: video_id null).
  async function addToCollection(collectionId: string, soundtrackId: string): Promise<boolean> {
    const existing = await supabase
      .from("collection_items")
      .select("id")
      .eq("collection_id", collectionId)
      .eq("soundtrack_id", soundtrackId)
      .is("video_id", null)
      .maybeSingle();
    if (existing.data) return true;

    const { error } = await supabase.from("collection_items").insert({
      collection_id: collectionId,
      soundtrack_id: soundtrackId,
      position: await nextPosition(collectionId),
    });
    return !error;
  }

  // Adds a single track (track item: video_id set). track_title is snapshotted.
  async function addTrackToCollection(
    collectionId: string,
    soundtrackId: string,
    videoId: string,
    trackTitle: string,
  ): Promise<boolean> {
    const existing = await supabase
      .from("collection_items")
      .select("id")
      .eq("collection_id", collectionId)
      .eq("video_id", videoId)
      .maybeSingle();
    if (existing.data) return true;

    const { error } = await supabase.from("collection_items").insert({
      collection_id: collectionId,
      soundtrack_id: soundtrackId,
      video_id: videoId,
      track_title: trackTitle,
      position: await nextPosition(collectionId),
    });
    return !error;
  }

  // Removes the whole-soundtrack (album) item — not any track items of the
  // same OST, which are addressed by video_id.
  async function removeFromCollection(collectionId: string, soundtrackId: string): Promise<boolean> {
    const { error } = await supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", collectionId)
      .eq("soundtrack_id", soundtrackId)
      .is("video_id", null);
    return !error;
  }

  // Removes a single track item by its video id.
  async function removeTrackFromCollection(collectionId: string, videoId: string): Promise<boolean> {
    const { error } = await supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", collectionId)
      .eq("video_id", videoId);
    return !error;
  }

  // Removes any item (album or track) by its row id — used when editing a
  // collection, where the exact item is already known.
  async function removeItemById(itemId: string): Promise<boolean> {
    const { error } = await supabase
      .from("collection_items")
      .delete()
      .eq("id", itemId);
    return !error;
  }

  async function moveItem(_collectionId: string, itemId: string, newPosition: number): Promise<boolean> {
    const { error } = await supabase
      .from("collection_items")
      .update({ position: newPosition })
      .eq("id", itemId);
    return !error;
  }

  // Collections (owned by the current user) that contain the whole soundtrack
  // as an album item — powers the checkbox state in the album add modal.
  async function getCollectionsContaining(soundtrackId: string): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("collection_items")
      .select("collection_id, collections!inner(user_id)")
      .eq("soundtrack_id", soundtrackId)
      .is("video_id", null)
      .eq("collections.user_id", user.id);
    return (data ?? []).map((r: any) => r.collection_id as string);
  }

  // Collections (owned by the current user) that contain a given track.
  async function getCollectionsContainingTrack(videoId: string): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from("collection_items")
      .select("collection_id, collections!inner(user_id)")
      .eq("video_id", videoId)
      .eq("collections.user_id", user.id);
    return (data ?? []).map((r: any) => r.collection_id as string);
  }

  return {
    myCollections,
    loading,
    publicCollections,
    loadingPublic,
    fetchPublicCollections,
    fetchMyCollections,
    fetchCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    addToCollection,
    addTrackToCollection,
    removeFromCollection,
    removeTrackFromCollection,
    removeItemById,
    moveItem,
    getCollectionsContaining,
    getCollectionsContainingTrack,
  };
});

// Without this, editing this setup store during dev hot-swaps the module but
// leaves the already-instantiated store in place — so newly added actions are
// missing on the live instance and calling one throws. See Pinia HMR docs.
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCollectionStore, import.meta.hot));
}
