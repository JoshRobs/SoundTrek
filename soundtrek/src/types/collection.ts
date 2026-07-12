import type { Soundtrack } from "./soundtrack";

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  creator_name: string | null;
  user_id: string;
  is_public: boolean;
  theme_tags: string[];
  created_at: string;
  updated_at: string;
  // joined
  collection_items?: CollectionItem[];
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  soundtrack_id: string;
  position: number;
  added_at: string;
  soundtrack?: Soundtrack;
}
