export type StreamingPlatform =
  | 'youtube'
  | 'spotify'
  | 'apple_music'
  | 'bandcamp'
  | 'soundcloud'
  | 'amazon_music'
  | 'other'

export interface StreamingLink {
  platform: StreamingPlatform
  url: string
  label?: string
}

export interface Soundtrack {
  id: string
  slug: string | null
  game_title: string
  studio: string
  composers: string[]
  console: string
  release_year: number
  cover_image_url: string | null
  cover_image_url_hd: string | null
  youtube_playlist_id: string | null
  youtube_video_id: string | null
  source_type: 'playlist' | 'video'
  spotify_id: string | null
  spotify_type: 'track' | 'album' | 'playlist' | null
  streaming_links: StreamingLink[]
  genre_tags: string[]
  theme_tags: string[]
  keyword_tags: string[]
  likes: number
  created_at: string
  description: string | null
  amazon_url: string | null
  amazon_image_url: string | null
}

export interface Composer {
  slug: string
  name: string
  bio: string | null
  support_url: string | null
  created_at: string
}

export interface FilterState {
  genres: string[]
  themes: string[]
  consoles: string[]
}

export interface ExploreRow {
  type: string
  label: string
  items: Soundtrack[]
}
