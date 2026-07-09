/**
 * SoundTrek Description Enrichment Script
 *
 * Fetches the game summary from IGDB and writes it to the description field
 * on the soundtracks table.
 *
 * Usage:
 *   npx tsx scripts/enrich-descriptions.ts
 *   npx tsx scripts/enrich-descriptions.ts --dry-run
 *   npx tsx scripts/enrich-descriptions.ts --force      # re-enrich already-populated rows
 *   npx tsx scripts/enrich-descriptions.ts --limit=100
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
  summary?: string
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

async function fetchIGDBDescription(gameTitle: string, token: string): Promise<string | null> {
  // Try exact match first
  const exact = await igdbPost(
    `fields name, summary; where name = "${escapeIgdb(gameTitle)}"; limit 1;`,
    token,
  )
  await sleep(250)

  if (exact[0]?.summary) return exact[0].summary

  // Fall back to search
  const results = await igdbPost(
    `search "${escapeIgdb(gameTitle)}"; fields name, summary; limit 5;`,
    token,
  )
  await sleep(250)

  const titleLower = gameTitle.toLowerCase()
  const match = results.find(g => g.name.toLowerCase() === titleLower) ?? results[0]
  return match?.summary ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SoundTrek Description Enrichment')
  if (DRY_RUN) console.log('  Mode: DRY RUN')
  if (FORCE)   console.log('  Force: re-enriching already-populated rows')
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const token = await getIGDBToken()

  const query = supabase
    .from('soundtracks')
    .select('id, game_title')
    .limit(LIMIT)

  if (!FORCE) {
    query.or('description.is.null,description.eq.')
  }

  const { data: rows, error } = await query

  if (error) throw error
  if (!rows?.length) { console.log('No rows need descriptions.'); return }

  console.log(`Rows to process: ${rows.length}\n`)

  let updated = 0
  let skipped = 0
  let failed  = 0

  for (const row of rows) {
    process.stdout.write(`→ ${row.game_title}... `)

    const description = await fetchIGDBDescription(row.game_title, token)

    if (!description) {
      console.log('not found')
      skipped++
      continue
    }

    // Truncate preview to one line for console output
    const preview = description.length > 80 ? description.slice(0, 80).trimEnd() + '…' : description
    console.log(preview)

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('soundtracks')
        .update({ description })
        .eq('id', row.id)

      if (updateError) {
        console.log(`  FAILED: ${updateError.message}`)
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
Skipped: ${skipped}
Failed:  ${failed}
────────────────────────────────`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
