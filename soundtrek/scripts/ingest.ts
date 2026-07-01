/**
 * SoundTrek ingestion script
 *
 * Pulls game metadata from IGDB and finds YouTube soundtracks via the YouTube
 * Data API, then inserts rows into the Supabase soundtracks table.
 *
 * Usage:
 *   npx tsx scripts/ingest.ts              # process next batch
 *   npx tsx scripts/ingest.ts --dry-run    # preview without inserting
 *   npx tsx scripts/ingest.ts --reset      # clear progress and start over
 *
 * YouTube quota: each Data API search costs 100 units (free tier = 10,000/day ≈ 100
 * searches/day).
 *
 * Composers: IGDB doesn't store individual composers. The studio name is stored
 * in the `studio` field and `composers` is left empty. Run enrich-composers.ts
 * afterwards to populate real composer names from VGMdb.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import 'dotenv/config'

// ── Config ────────────────────────────────────────────────────────────────────

const TWITCH_CLIENT_ID     = requireEnv('TWITCH_CLIENT_ID')
const TWITCH_CLIENT_SECRET = requireEnv('TWITCH_CLIENT_SECRET')
const SUPABASE_URL         = requireEnv('VITE_SUPABASE_URL')
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY')

const DRY_RUN     = process.argv.includes('--dry-run')
const RESET       = process.argv.includes('--reset')
const BATCH_SIZE  = parseInt(process.env.INGEST_BATCH_SIZE ?? '80')

const YOUTUBE_API_KEY = requireEnv('YOUTUBE_API_KEY')
const PROGRESS_FILE = 'scripts/.progress.json'

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required env var: ${name}`)
  return val
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface IGDBGame {
  id: number
  name: string
  rating?: number
  rating_count?: number
  first_release_date?: number
  cover?: { url: string }
  platforms?: { name: string }[]
  genres?: { name: string; id: number }[]
  involved_companies?: { company: { name: string }; developer: boolean; publisher: boolean }[]
}

interface Progress {
  processedIgdbIds: number[]
  offset: number
}

// ── IGDB genre → mood_tags heuristic ─────────────────────────────────────────
// These are rough starting points — refine in the DB later

const GENRE_MOOD_MAP: Record<string, string[]> = {
  'Role-playing (RPG)': ['epic', 'emotional'],
  'Adventure':          ['adventurous', 'epic'],
  'Platform':           ['upbeat', 'energetic'],
  'Shooter':            ['intense', 'adrenaline'],
  "Hack and slash/Beat 'em up": ['intense', 'upbeat'],
  'Fighting':           ['intense', 'upbeat'],
  'Strategy':           ['ambient', 'epic'],
  'Turn-based strategy':['ambient', 'nostalgic'],
  'Puzzle':             ['relaxing', 'quirky'],
  'Racing':             ['upbeat', 'energetic'],
  'Sport':              ['upbeat', 'energetic'],
  'Horror':             ['dark', 'intense', 'ambient'],
  'Simulator':          ['relaxing', 'ambient'],
  'Arcade':             ['upbeat', 'nostalgic'],
  'Music':              ['upbeat', 'energetic'],
  'Visual Novel':       ['emotional', 'ambient'],
}

// Bayesian weighted rating: pulls low-vote games toward the mean (C=70, m=500)
function computePopularity(rating: number | undefined, ratingCount: number | undefined): number | null {
  if (!rating || !ratingCount) return null
  const C = 70   // assumed mean IGDB rating
  const m = 500  // minimum votes before a rating is fully trusted
  return (ratingCount / (ratingCount + m)) * rating + (m / (ratingCount + m)) * C
}

function deriveMoodTags(game: IGDBGame): string[] {
  const tags = new Set<string>()
  for (const genre of game.genres ?? []) {
    const moods = GENRE_MOOD_MAP[genre.name] ?? []
    moods.forEach(m => tags.add(m))
  }
  return [...tags]
}

// ── IGDB ──────────────────────────────────────────────────────────────────────

async function getIGDBToken(): Promise<string> {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  )
  const data = await res.json() as { access_token: string }
  if (!data.access_token) throw new Error('Failed to get IGDB token')
  return data.access_token
}

async function fetchIGDBGames(token: string, offset: number): Promise<IGDBGame[]> {
  const body = `
    fields name, rating, rating_count, first_release_date, cover.url,
           platforms.name, genres.name, genres.id,
           involved_companies.company.name,
           involved_companies.developer,
           involved_companies.publisher;
    where rating_count > 50
      & first_release_date != null
      & cover != null
      & version_parent = null;
    sort rating_count desc;
    limit ${BATCH_SIZE};
    offset ${offset};
  `.trim()

  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-ID': TWITCH_CLIENT_ID,
      'Content-Type': 'text/plain',
    },
    body,
  })

  if (!res.ok) throw new Error(`IGDB request failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<IGDBGame[]>
}

function parseCoverUrl(url: string): string {
  return `https:${url.replace('t_thumb', 't_cover_big')}`
}

function parseCoverUrlHd(url: string): string {
  return `https:${url.replace('t_thumb', 't_cover_big_2x')}`
}

function parseDeveloper(game: IGDBGame): string {
  const dev = game.involved_companies?.find(c => c.developer)
  const pub = game.involved_companies?.find(c => c.publisher)
  return dev?.company.name ?? pub?.company.name ?? 'Unknown'
}

function parsePlatform(game: IGDBGame): string {
  const platforms = game.platforms?.map(p => p.name) ?? []
  // Prefer a console name over PC/Mac/Linux
  const console_ = platforms.find(p => !['PC', 'Mac', 'Linux', 'Android', 'iOS'].includes(p))
  return console_ ?? platforms[0] ?? 'Unknown'
}

function parseReleaseYear(game: IGDBGame): number {
  if (!game.first_release_date) return 0
  return new Date(game.first_release_date * 1000).getFullYear()
}

// ── YouTube (Data API) ────────────────────────────────────────────────────────

async function fetchFirstPlaylistVideo(playlistId: string): Promise<string | null> {
  const params = new URLSearchParams({
    part: 'contentDetails',
    playlistId,
    maxResults: '1',
    key: YOUTUBE_API_KEY,
  })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`)
  const data = await res.json() as {
    items?: { contentDetails: { videoId: string } }[]
    error?: { message: string; code: number }
  }
  return data.items?.[0]?.contentDetails?.videoId ?? null
}

async function searchYouTube(gameTitle: string): Promise<{
  youtube_video_id: string | null
  youtube_playlist_id: string | null
  source_type: 'video' | 'playlist'
} | null> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: `${gameTitle} full OST complete soundtrack`,
    maxResults: '5',
    relevanceLanguage: 'en',
    key: YOUTUBE_API_KEY,
  })

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  const data = await res.json() as {
    items?: { id: { kind: string; videoId?: string; playlistId?: string } }[]
    error?: { message: string; code: number }
  }

  if (data.error) {
    const isQuota = data.error.code === 403 || data.error.message?.toLowerCase().includes('quota')
    if (isQuota) {
      console.error('\n⚠ YouTube quota exceeded. Progress saved — run again tomorrow.')
      process.exit(0)
    }
    console.warn(`  YouTube error: ${data.error.message}`)
    return null
  }

  if (!data.items?.length) return null

  // Prefer a playlist — also fetch first video so the embed has a starting point
  const playlist = data.items.find(i => i.id.kind === 'youtube#playlist')
  if (playlist?.id.playlistId) {
    const firstVideoId = await fetchFirstPlaylistVideo(playlist.id.playlistId)
    return {
      youtube_playlist_id: playlist.id.playlistId,
      youtube_video_id: firstVideoId,
      source_type: 'playlist',
    }
  }

  // Fall back to a single video
  const video = data.items.find(i => i.id.kind === 'youtube#video')
  if (video?.id.videoId) {
    return { youtube_video_id: video.id.videoId, youtube_playlist_id: null, source_type: 'video' }
  }

  return null
}

// ── Progress ──────────────────────────────────────────────────────────────────

function loadProgress(): Progress {
  if (RESET || !existsSync(PROGRESS_FILE)) return { processedIgdbIds: [], offset: 0 }
  return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8')) as Progress
}

function saveProgress(p: Progress) {
  mkdirSync('scripts', { recursive: true })
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`SoundTrek Ingestion Script`)
  if (DRY_RUN) console.log('  Mode: DRY RUN (nothing will be inserted)')
  console.log('  YouTube: Data API (100 units/search, 10,000/day)')
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const token    = await getIGDBToken()
  const progress = loadProgress()

  console.log(`Offset: ${progress.offset} | Already processed: ${progress.processedIgdbIds.length}`)

  const games = await fetchIGDBGames(token, progress.offset)
  if (!games.length) {
    console.log('No more games returned from IGDB.')
    return
  }

  const toProcess = games.filter(g => !progress.processedIgdbIds.includes(g.id))
  console.log(`Fetched: ${games.length} | To process this run: ${toProcess.length}\n`)

  let inserted = 0
  let skipped  = 0
  let failed   = 0

  for (const game of toProcess) {
    process.stdout.write(`→ ${game.name} `)

    // Skip if already in DB by title
    const { count } = await supabase
      .from('soundtracks')
      .select('*', { count: 'exact', head: true })
      .eq('game_title', game.name)

    if ((count ?? 0) > 0) {
      console.log('(already in DB, skipped)')
      progress.processedIgdbIds.push(game.id)
      skipped++
      continue
    }

    // YouTube search
    const yt = await searchYouTube(game.name)
    if (yt) {
      const ytId = yt.youtube_video_id ?? yt.youtube_playlist_id
      process.stdout.write(`[YT: ${yt.source_type} ${ytId}] `)
    } else {
      process.stdout.write('[YT: not found] ')
    }

    const row = {
      game_title:          game.name,
      studio:              parseDeveloper(game),
      composers:           [] as string[], // populated by enrich-composers.ts
      console:             parsePlatform(game),
      release_year:        parseReleaseYear(game),
      cover_image_url:     game.cover ? parseCoverUrl(game.cover.url) : null,
      cover_image_url_hd:  game.cover ? parseCoverUrlHd(game.cover.url) : null,
      source_type:         yt?.source_type ?? 'video',
      youtube_playlist_id: yt?.youtube_playlist_id ?? null,
      genre_tags:          game.genres?.map(g => g.name.toLowerCase()) ?? [],
      mood_tags:           deriveMoodTags(game),
      rating:              game.rating ?? null,
      rating_count:        game.rating_count ?? null,
      popularity:          computePopularity(game.rating, game.rating_count),
    }

    if (!DRY_RUN) {
      const { error } = await supabase.from('soundtracks').insert(row)
      if (error) {
        console.log(`FAILED (${error.message})`)
        failed++
      } else {
        console.log('✓')
        inserted++
      }
    } else {
      console.log('(dry run)')
      inserted++
    }

    progress.processedIgdbIds.push(game.id)
    saveProgress(progress)

    await sleep(300) // be polite to both APIs
  }

  progress.offset += BATCH_SIZE
  saveProgress(progress)

  const quotaLine = `YouTube quota used: ~${(inserted + failed) * 100} / 10,000 units\n`
  console.log(`
────────────────────────────────
Inserted : ${inserted}
Skipped  : ${skipped} (already in DB)
Failed   : ${failed}
${quotaLine}Next offset: ${progress.offset}
────────────────────────────────
Run again to continue.
`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
