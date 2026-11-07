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
 * Only rows with a null youtube_video_id are processed, so existing (including
 * manually set) video IDs are never overwritten and the script is safe to run
 * from multiple machines. Rows searched without a match are recorded locally
 * so they aren't re-searched on every run.
 *
 * Usage:
 *   npx tsx scripts/enrich-video-ids.ts
 *   npx tsx scripts/enrich-video-ids.ts --dry-run
 *   npx tsx scripts/enrich-video-ids.ts --batch=200
 *   npx tsx scripts/enrich-video-ids.ts --reset      # clear not-found list and retry those rows
 */

import { Innertube } from 'youtubei.js'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import 'dotenv/config'
// Search + scoring live in src/utils/ostVideo.ts so the admin "Add Soundtrack"
// import (youtube-proxy worker) picks exactly the same video as this script.
import { findOstVideo, MIN_DURATION, MIN_SCORE, CONFIDENT } from '../src/utils/ostVideo'

const SUPABASE_URL         = requireEnv('VITE_SUPABASE_URL')
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY')

const DRY_RUN       = process.argv.includes('--dry-run')
const RESET         = process.argv.includes('--reset')
const BATCH_SIZE    = parseInt(process.argv.find(a => a.startsWith('--batch='))?.split('=')[1] ?? '200')
const PROGRESS_FILE = 'scripts/.progress-video-ids.json'

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
  // IDs of rows that were searched but had no match above threshold.
  // Rows that got a video are skipped via the IS NULL filter instead.
  notFoundIds: string[]
}

function loadProgress(): Progress {
  if (RESET || !existsSync(PROGRESS_FILE)) return { notFoundIds: [] }
  const raw = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'))
  // Older progress files stored every processed ID as processedIds. Any of those
  // that still have a null youtube_video_id were not-found rows, so treat them the same.
  return { notFoundIds: raw.notFoundIds ?? raw.processedIds ?? [] }
}

function saveProgress(p: Progress) {
  mkdirSync('scripts', { recursive: true })
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
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

  const notFoundSet = new Set(progress.notFoundIds)

  // Paginated fetch of rows still missing a video — Supabase default limit is
  // 1000, must page for larger catalogs
  let nullRows: { id: string; game_title: string }[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error: idErr } = await supabase
      .from('soundtracks')
      .select('id, game_title')
      .is('youtube_video_id', null)
      .order('id')
      .range(from, from + PAGE - 1)
    if (idErr) throw idErr
    nullRows = nullRows.concat(data ?? [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }

  const candidates = nullRows.filter(r => !notFoundSet.has(r.id))
  const rows = candidates.slice(0, BATCH_SIZE)

  const skippedNotFound = nullRows.length - candidates.length
  if (skippedNotFound > 0) console.log(`Skipping ${skippedNotFound} previously not-found rows.`)

  if (!rows.length) {
    console.log('All rows processed.')
    return
  }

  console.log(`Rows to process this run: ${rows.length}\n`)

  const yt = await Innertube.create()

  let updated  = 0
  let rejected = 0
  let notFound = 0
  let failed   = 0

  for (const row of rows) {
    process.stdout.write(`→ ${row.game_title}\n`)

    const result = await findOstVideo(
      async q => (await yt.search(q, { type: 'video' })).videos,
      row.game_title,
    )

    if (!result) {
      console.log('  [no match above threshold]\n')
      notFound++
      if (!DRY_RUN) {
        progress.notFoundIds.push(row.id)
        saveProgress(progress)
      }
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

    await sleep(1200)
  }

  const remaining = candidates.length - rows.length

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
