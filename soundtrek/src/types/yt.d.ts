declare namespace YT {
  class Player {
    constructor(element: string | HTMLElement, options: PlayerOptions)
    playVideo(): void
    pauseVideo(): void
    setVolume(volume: number): void
    nextVideo(): void
    previousVideo(): void
    playVideoAt(index: number): void
    getPlaylistIndex(): number
    getPlayerState(): number
    destroy(): void
  }

  interface PlayerOptions {
    videoId?: string
    width?: number | string
    height?: number | string
    playerVars?: {
      autoplay?: 0 | 1
      list?: string
      listType?: string
      rel?: 0 | 1
    }
    events?: {
      onReady?: (e: { target: Player }) => void
      onStateChange?: (e: { target: Player; data: number }) => void
    }
  }
}

interface Window {
  YT: typeof YT
  onYouTubeIframeAPIReady?: () => void
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_YOUTUBE_API_KEY?: string
}
