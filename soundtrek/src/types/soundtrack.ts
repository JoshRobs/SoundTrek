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
  game_title: string
  composer: string
  console: string
  release_year: number
  cover_image_url: string | null
  youtube_playlist_id: string | null
  youtube_video_id: string | null
  source_type: 'playlist' | 'video'
  spotify_id: string | null
  spotify_type: 'track' | 'album' | 'playlist' | null
  streaming_links: StreamingLink[]
  mood_tags: string[]
  genre_tags: string[]
  theme_tags: string[]
  likes: number
  created_at: string
}

export interface FilterState {
  moods: string[]
  genres: string[]
  themes: string[]
  consoles: string[]
}

export interface ExploreRow {
  type: string
  label: string
  items: Soundtrack[]
}
