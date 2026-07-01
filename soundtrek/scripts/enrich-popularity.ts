/**
 * SoundTrek Popularity Enrichment Script
 *
 * Fetches rating, rating_count, and computed popularity from IGDB for
 * existing rows that don't have these values yet.
 *
 * Usage:
 *   npx tsx scripts/enrich-popularity.ts
 *   npx tsx scripts/enrich-popularity.ts --dry-run
 *   npx tsx scripts/enrich-popularity.ts --force    # re-enrich already-populated rows
 *   npx tsx scripts/enrich-popularity.ts --limit=100
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const TWITCH_CLIENT_ID     = requireEnv('TWITCH_CLIENT_ID')
const TWITCH_CLIENT_SECRET = requireEnv('TWITCH_CLIENT_SECRET')
const SUPABASE_URL         = requireEnv('VITE_SUPABASE_URL')
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY')

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE   = process.argv.includes('--force')
const LIMIT   = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '500')

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env var: ${name}`)
  return val
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function escapeIgdb(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// Bayesian weighted rating: pulls low-vote games toward the mean (C=70, m=500)
function computePopularity(rating: number | null, ratingCount: number | null): number | null {
  if (!rating || !ratingCount) return null
  const C = 70
  const m = 500
  return (ratingCount / (ratingCount + m)) * rating + (m / (ratingCount + m)) * C
}

// ── IGDB ──────────────────────────────────────────────────────────────────────

async function getIGDBToken(): Promise<string> {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' },
  )
  const data = await res.json() as { access_token: string }
  if (!data.access_token) throw new Error('Failed to get IGDB token')
  return data.access_token
}

interface IGDBGame {
  name: string
  rating?: number
  rating_count?: number
}

async function igdbPost(body: string, token: string): Promise<IGDBGame[]> {
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-ID': TWITCH_CLIENT_ID,
      'Content-Type': 'text/plain',
    },
    body,
  })
  if (!res.ok) return []
  return res.json() as Promise<IGDBGame[]>
}

async function fetchIGDBRatings(
  gameTitle: string,
  token: string,
): Promise<{ rating: number | null; rating_count: number | null }> {
  const exact = await igdbPost(
    `fields name, rating, rating_count; where name = "${escapeIgdb(gameTitle)}"; limit 1;`,
    token,
  )
  await sleep(250)

  if (exact[0] && (exact[0].rating != null || exact[0].rating_count != null)) {
    return {
      rating: exact[0].rating ?? null,
      rating_count: exact[0].rating_count ?? null,
    }
  }

  const results = await igdbPost(
    `search "${escapeIgdb(gameTitle)}"; fields name, rating, rating_count; limit 5;`,
    token,
  )
  await sleep(250)

  const titleLower = gameTitle.toLowerCase()
  const match = results.find(g => g.name.toLowerCase() === titleLower) ?? results[0]
  return {
    rating: match?.rating ?? null,
    rating_count: match?.rating_count ?? null,
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SoundTrek Popularity Enrichment')
  if (DRY_RUN) console.log('  Mode: DRY RUN')
  if (FORCE)   console.log('  Force: re-enriching already-populated rows')
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const token = await getIGDBToken()

  const query = supabase
    .from('soundtracks')
    .select('id, game_title, rating, rating_count')
    .limit(LIMIT)

  if (!FORCE) {
    query.is('rating_count', null)
  }

  const { data: toProcess, error } = await query
  if (error) throw error
  if (!toProcess?.length) { console.log('No rows need enrichment.'); return }

  console.log(`Rows to process: ${toProcess.length}\n`)

  let updated = 0
  let skipped = 0
  let failed  = 0

  for (const row of toProcess) {
    process.stdout.write(`→ ${row.game_title}... `)
    const { rating, rating_count } = await fetchIGDBRatings(row.game_title, token)

    if (rating == null && rating_count == null) {
      console.log('not found')
      skipped++
      continue
    }

    const popularity = computePopularity(rating, rating_count)
    const display = [
      rating != null ? `rating=${rating.toFixed(1)}` : null,
      rating_count != null ? `votes=${rating_count}` : null,
      popularity != null ? `pop=${popularity.toFixed(1)}` : null,
    ].filter(Boolean).join(' ')
    console.log(display)

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('soundtracks')
        .update({ rating, rating_count, popularity })
        .eq('id', row.id)

      if (updateError) {
        console.error(`  FAILED: ${updateError.message}`)
        failed++
      } else {
        updated++
      }
    } else {
      updated++
    }
  }

  console.log(`
────────────────────────────────
Updated: ${updated}
Skipped: ${skipped} (not found in IGDB)
Failed:  ${failed}
────────────────────────────────`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
