/**
 * SoundTrek — Video ID enrichment script
 *
 * Uses youtubei.js (YouTube's internal Innertube API — no API key, no quota)
 * to find a single long-form video for each soundtrack and writes it to
 * youtube_video_id in Supabase, overwriting whatever was there before.
 *
 * Prefers videos longer than 20 minutes (full OST compilations).
 * Falls back to the top result if nothing long enough is found.
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
const MIN_DURATION  = 20 * 60  // 20 minutes in seconds

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env var: ${name}`)
  return val
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

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

// ── Search ────────────────────────────────────────────────────────────────────

async function searchSingleVideo(
  yt: Awaited<ReturnType<typeof Innertube.create>>,
  gameTitle: string,
): Promise<{ videoId: string; title: string; seconds: number } | null> {
  const results = await yt.search(
    `${gameTitle} full OST complete soundtrack`,
    { type: 'video' },
  )

  const videos = results.videos
  if (!videos?.length) return null

  // Prefer a video longer than MIN_DURATION
  const longVideo = videos.find(v => (v.duration?.seconds ?? 0) >= MIN_DURATION)
  const best = longVideo ?? videos[0]

  if (!best?.id) return null

  return {
    videoId: best.id,
    title: best.title?.text ?? '',
    seconds: best.duration?.seconds ?? 0,
  }
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
  if (DRY_RUN) console.log('  Mode         : DRY RUN (no writes)')
  if (RESET)   console.log('  Progress     : reset')
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const progress = loadProgress()

  console.log(`Already processed: ${progress.processedIds.length}`)

  // Fetch next unprocessed batch
  const query = supabase
    .from('soundtracks')
    .select('id, game_title')
    .limit(BATCH_SIZE)

  if (progress.processedIds.length) {
    query.not('id', 'in', `(${progress.processedIds.join(',')})`)
  }

  const { data: rows, error } = await query

  if (error) throw error
  if (!rows?.length) {
    console.log('All rows processed.')
    return
  }

  console.log(`Rows to process this run: ${rows.length}\n`)

  const yt = await Innertube.create()

  let updated  = 0
  let notFound = 0
  let failed   = 0

  for (const row of rows) {
    process.stdout.write(`→ ${row.game_title} `)

    const result = await searchSingleVideo(yt, row.game_title)

    if (!result) {
      console.log('[not found]')
      notFound++
    } else {
      const durationStr = formatDuration(result.seconds)
      const flag = result.seconds < MIN_DURATION ? ' ⚠ short' : ''
      process.stdout.write(`[${result.videoId} · ${durationStr}${flag}] `)

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('soundtracks')
          .update({ youtube_video_id: result.videoId })
          .eq('id', row.id)

        if (updateError) {
          console.log(`FAILED (${updateError.message})`)
          failed++
        } else {
          console.log('✓')
          updated++
        }
      } else {
        console.log('(dry run)')
        updated++
      }
    }

    progress.processedIds.push(row.id)
    saveProgress(progress)

    // Be polite — ~1 req/sec to avoid soft IP blocks
    await sleep(1200)
  }

  const remaining = (await supabase
    .from('soundtracks')
    .select('id', { count: 'exact', head: true })
    .not('id', 'in', `(${progress.processedIds.join(',')})`)).count ?? 0

  console.log(`
────────────────────────────────
Updated  : ${updated}
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
