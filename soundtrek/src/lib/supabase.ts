import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'
)

// Every column a soundtrack needs to render as a card/list row AND play in
// the persistent player. Omits only description, keyword_tags, amazon_url,
// and amazon_image_url — those are used solely by SoundtrackView (which
// fetches its own full row) and the admin (which loads fresh full rows).
// Cuts multi-row query egress roughly in half. rating_count stays: it feeds
// displayLikes().
// Kept as a single string literal — supabase-js parses the select string at
// the type level, and a runtime-joined string breaks that inference.
export const SOUNDTRACK_LIST_COLUMNS =
  'id,slug,game_title,studio,composers,console,release_year,cover_image_url,cover_image_url_hd,youtube_playlist_id,youtube_video_id,source_type,spotify_id,spotify_type,streaming_links,genre_tags,theme_tags,likes,rating_count,total_likes,created_at'
