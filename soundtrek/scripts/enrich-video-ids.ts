/**
 * SoundTrek — Video ID enrichment script
 *
 * Uses youtubei.js (YouTube's internal Innertube API — no API key, no quota)
 * to find a single long-form video for each soundtrack and writes it to
 * youtube_video_id in Supabase.
 *
 * Videos are scored and must pass a minimum threshold to be accepted.
 * Results that barely pass are flagged with ⚠ so you can spot-check them.
 *
 * Usage:
 *   npx tsx scripts/enrich-video-ids.ts
 *   npx tsx scripts/enrich-video-ids.ts --dry-run
 *   npx tsx scripts/enrich-video-ids.ts --batch=200
 *   npx tsx scripts/enrich-video-ids.ts --reset      # clear progress and restart
 */

import { Innertube } from 'youtubei.js'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import 'dotenv/config'

const SUPABASE_URL         = requireEnv('VITE_SUPABASE_URL')
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY')

const DRY_RUN       = process.argv.includes('--dry-run')
const RESET         = process.argv.includes('--reset')
const BATCH_SIZE    = parseInt(process.argv.find(a => a.startsWith('--batch='))?.split('=')[1] ?? '200')
const PROGRESS_FILE = 'scripts/.progress-video-ids.json'
const MIN_DURATION  = 20 * 60   // 20 minutes in seconds
const MIN_SCORE     = 4         // minimum score to accept a result
const CONFIDENT     = 7         // score above which no warning is shown

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env var: ${name}`)
  return val
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Progress ──────────────────────────────────────────────────────────────────

interface Progress {
  processedIds: string[]
}

function loadProgress(): Progress {
  if (RESET || !existsSync(PROGRESS_FILE)) return { processedIds: [] }
  return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8')) as Progress
}

function saveProgress(p: Progress) {
  mkdirSync('scripts', { recursive: true })
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

// ── Scoring ───────────────────────────────────────────────────────────────────

const BAD_KEYWORDS = [
  'cover', 'covers', 'remix', 'remixed', 'piano', 'tribute',
  'arrangement', 'arranged', 'karaoke', 'lofi', 'lo-fi',
  'chiptune', 'jazz', '8-bit', '8bit', 'fan made', 'fan-made',
  'loop', 'walkthrough', '1 hour', 'one hour', 'extended',
  'menu theme', 'lobby theme', 'title screen',
]

const OST_KEYWORDS = [
  'original soundtrack', 'original game soundtrack', 'original score',
  'full ost', 'complete ost', 'full soundtrack', 'complete soundtrack',
  'game music', 'music from', ' ost ',
]

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

// Roman numerals I–XXX — covers any realistic game series
const ROMAN_NUMERALS = new Set([
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
  'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
  'xxi', 'xxii', 'xxiii', 'xxiv', 'xxv', 'xxvi', 'xxvii', 'xxviii', 'xxix', 'xxx',
])

// Returns true if the video title contains the game title followed immediately
// by a series number (Arabic or Roman) that isn't already part of the game title.
// e.g. game="Forza Horizon",  video="Forza Horizon 6 OST"   → true  (reject)
//      game="Forza Horizon 5", video="Forza Horizon 5 OST"  → false (accept)
//      game="Final Fantasy",   video="Final Fantasy VII OST" → true  (reject)
//      game="Final Fantasy VII", video="Final Fantasy VII OST" → false (accept)
function hasUnexpectedSeriesNumber(gt: string, vt: string): boolean {
  const idx = vt.indexOf(gt)
  if (idx === -1) return false
  const after = vt.slice(idx + gt.length).trimStart()

  // Check Arabic numeral
  const arabicMatch = after.match(/^(\d+)/)
  if (arabicMatch) {
    const gameNumbers = gt.match(/\d+/g) ?? []
    if (!gameNumbers.includes(arabicMatch[1])) return true
  }

  // Check Roman numeral (next whitespace-delimited token)
  const romanMatch = after.match(/^([a-z]+)/)
  if (romanMatch && ROMAN_NUMERALS.has(romanMatch[1])) {
    const gameRomans = gt.split(' ').filter(w => ROMAN_NUMERALS.has(w))
    if (!gameRomans.includes(romanMatch[1])) return true
  }

  return false
}

function scoreVideo(videoTitle: string, gameTitle: string, durationSeconds: number): number {
  const vt = normalize(videoTitle)
  const gt = normalize(gameTitle)

  // Hard reject: too short, fake "exactly 1 hour" videos, or bad keywords
  if (durationSeconds < MIN_DURATION) return -1
  if (Math.abs(durationSeconds - 3600) <= 2) return -1
  if (BAD_KEYWORDS.some(b => vt.includes(b))) return -1

  let score = 0

  // Game title must appear verbatim in the video title — hard reject otherwise
  if (vt === gt) {
    score += 5
  } else if (vt.includes(gt)) {
    score += 4
  } else {
    return -1
  }

  // Reject if the video is for a different numbered entry in the series
  // e.g. game "Forza Horizon" must not match "Forza Horizon 6 OST"
  if (hasUnexpectedSeriesNumber(gt, vt)) return -1

  // Must contain "soundtrack" or "ost" — hard reject otherwise
  if (!vt.includes('soundtrack') && !vt.includes(' ost') && !vt.includes('(ost)') && !vt.includes('[ost]')) return -1

  // Bonus for more specific OST keywords
  if (OST_KEYWORDS.some(k => vt.includes(k))) score += 3
  else score += 1

  // Bonus for hour+ videos — very likely a full OST
  if (durationSeconds >= 60 * 60) score += 1

  return score
}

// ── Search ────────────────────────────────────────────────────────────────────

interface VideoResult {
  videoId: string
  title: string
  seconds: number
  score: number
}

async function searchSingleVideo(
  yt: Awaited<ReturnType<typeof Innertube.create>>,
  gameTitle: string,
): Promise<VideoResult | null> {
  // Try multiple queries, take the best-scoring result across all of them
  const queries = [
    `${gameTitle} original soundtrack`,
    `${gameTitle} full OST`,
    `${gameTitle} complete soundtrack`,
  ]

  let best: VideoResult | null = null

  for (const query of queries) {
    let results
    try {
      results = await yt.search(query, { type: 'video' })
    } catch {
      continue
    }

    for (const v of results.videos ?? []) {
      if (!v.id || !v.title?.text) continue
      const score = scoreVideo(v.title.text, gameTitle, v.duration?.seconds ?? 0)
      if (score < MIN_SCORE) continue
      if (!best || score > best.score) {
        best = {
          videoId: v.id,
          title: v.title.text,
          seconds: v.duration?.seconds ?? 0,
          score,
        }
      }
    }

    // Short-circuit if we have a confident result
    if (best && best.score >= CONFIDENT) break

    await sleep(800)
  }

  return best
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SoundTrek — Video ID Enrichment (no-quota)')
  console.log(`  Batch size   : ${BATCH_SIZE}`)
  console.log(`  Min duration : ${MIN_DURATION / 60} min`)
  console.log(`  Min score    : ${MIN_SCORE} / ${CONFIDENT} (confident)`)
  if (DRY_RUN) console.log('  Mode         : DRY RUN (no writes)')
  if (RESET)   console.log('  Progress     : reset')
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const progress = loadProgress()

  console.log(`Already processed: ${progress.processedIds.length}`)

  // Paginated ID fetch — Supabase default limit is 1000, must page for larger catalogs
  let allIdRows: { id: string }[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error: idErr } = await supabase
      .from('soundtracks')
      .select('id')
      .range(from, from + PAGE - 1)
    if (idErr) throw idErr
    allIdRows = allIdRows.concat(data ?? [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }

  const processedSet  = new Set(progress.processedIds)
  const unprocessedIds = (allIdRows ?? [])
    .map(r => r.id as string)
    .filter(id => !processedSet.has(id))
    .slice(0, BATCH_SIZE)

  if (!unprocessedIds.length) {
    console.log('All rows processed.')
    return
  }

  const { data: rows, error } = await supabase
    .from('soundtracks')
    .select('id, game_title')
    .in('id', unprocessedIds)

  if (error) throw error

  console.log(`Rows to process this run: ${rows?.length ?? 0}\n`)

  const yt = await Innertube.create()

  let updated  = 0
  let rejected = 0
  let notFound = 0
  let failed   = 0

  for (const row of rows) {
    process.stdout.write(`→ ${row.game_title}\n`)

    const result = await searchSingleVideo(yt, row.game_title)

    if (!result) {
      console.log('  [no match above threshold]\n')
      notFound++
    } else {
      const durationStr = formatDuration(result.seconds)
      const lowConf = result.score < CONFIDENT ? ' ⚠ low confidence' : ''
      console.log(`  "${result.title}"`)
      console.log(`  ${result.videoId} · ${durationStr} · score=${result.score}${lowConf}`)

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('soundtracks')
          .update({ youtube_video_id: result.videoId })
          .eq('id', row.id)

        if (updateError) {
          console.log(`  FAILED: ${updateError.message}`)
          failed++
        } else {
          console.log('  ✓ saved')
          updated++
        }
      } else {
        console.log('  (dry run)')
        updated++
      }
    }

    console.log('')

    progress.processedIds.push(row.id)
    saveProgress(progress)

    await sleep(1200)
  }

  const { count: totalCount } = await supabase
    .from('soundtracks')
    .select('id', { count: 'exact', head: true })
  const remaining = (totalCount ?? 0) - progress.processedIds.length

  console.log(`
────────────────────────────────
Updated  : ${updated}
Rejected : ${rejected}
Not found: ${notFound}
Failed   : ${failed}
Remaining: ${remaining} rows
────────────────────────────────${remaining > 0 ? '\nRun again to continue.' : '\nAll done!'}
`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
