/**
 * SoundTrek Keyword Enrichment Script
 *
 * Fetches IGDB keyword tags for each soundtrack and writes them to the
 * keyword_tags column on the soundtracks table.
 *
 * IGDB keywords are user-generated descriptors (e.g. "open-world", "stealth",
 * "dragons") — more granular than themes or genres.
 *
 * Requires the column to exist first:
 *   ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS keyword_tags text[];
 *
 * Usage:
 *   npx tsx scripts/enrich-keywords.ts
 *   npx tsx scripts/enrich-keywords.ts --dry-run
 *   npx tsx scripts/enrich-keywords.ts --force      # re-enrich already-populated rows
 *   npx tsx scripts/enrich-keywords.ts --limit=100
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
  keywords?: { name: string }[]
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

async function fetchIGDBKeywords(gameTitle: string, token: string): Promise<string[]> {
  // Try exact match first
  const exact = await igdbPost(
    `fields name, keywords.name; where name = "${escapeIgdb(gameTitle)}"; limit 1;`,
    token,
  )
  await sleep(250)

  if (exact[0]?.keywords?.length) {
    return exact[0].keywords.map(k => k.name.toLowerCase())
  }

  // Fall back to search
  const results = await igdbPost(
    `search "${escapeIgdb(gameTitle)}"; fields name, keywords.name; limit 5;`,
    token,
  )
  await sleep(250)

  const titleLower = gameTitle.toLowerCase()
  const match = results.find(g => g.name.toLowerCase() === titleLower) ?? results[0]
  return match?.keywords?.map(k => k.name.toLowerCase()) ?? []
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SoundTrek Keyword Enrichment')
  if (DRY_RUN) console.log('  Mode: DRY RUN')
  if (FORCE)   console.log('  Force: re-enriching already-populated rows')
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const token = await getIGDBToken()

  const query = supabase
    .from('soundtracks')
    .select('id, game_title, keyword_tags')
    .limit(LIMIT)

  if (!FORCE) {
    query.or('keyword_tags.is.null,keyword_tags.eq.{}')
  }

  const { data: rows, error } = await query

  if (error) throw error
  if (!rows?.length) { console.log('No rows need keywords.'); return }

  console.log(`Rows to process: ${rows.length}\n`)

  let updated = 0
  let skipped = 0
  let failed  = 0

  for (const row of rows) {
    process.stdout.write(`→ ${row.game_title}... `)

    const keywords = await fetchIGDBKeywords(row.game_title, token)

    if (!keywords.length) {
      console.log('not found')
      skipped++
      continue
    }

    console.log(keywords.slice(0, 6).join(', ') + (keywords.length > 6 ? ` +${keywords.length - 6} more` : ''))

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('soundtracks')
        .update({ keyword_tags: keywords })
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
