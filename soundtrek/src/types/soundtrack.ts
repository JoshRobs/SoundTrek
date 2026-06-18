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
  mood_tags: string[]
  genre_tags: string[]
  created_at: string
}

export interface FilterState {
  moods: string[]
  genres: string[]
  consoles: string[]
}
