/**
 * SoundTrek Theme Enrichment Script
 *
 * Fetches theme_tags for each soundtrack via IGDB and updates the soundtracks table.
 *
 * Usage:
 *   npx tsx scripts/enrich-themes.ts
 *   npx tsx scripts/enrich-themes.ts --dry-run
 *   npx tsx scripts/enrich-themes.ts --force      # re-enrich already-populated rows
 *   npx tsx scripts/enrich-themes.ts --limit=100
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
  themes?: { name: string }[]
}

async function igdbPost(endpoint: string, body: string, token: string): Promise<IGDBGame[]> {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
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

async function fetchIGDBThemes(gameTitle: string, token: string): Promise<string[]> {
  const exact = await igdbPost(
    'games',
    `fields name, themes.name; where name = "${escapeIgdb(gameTitle)}"; limit 1;`,
    token,
  )
  await sleep(250)

  if (exact[0]?.themes?.length) {
    return exact[0].themes.map(t => t.name.toLowerCase())
  }

  const results = await igdbPost(
    'games',
    `search "${escapeIgdb(gameTitle)}"; fields name, themes.name; limit 5;`,
    token,
  )
  await sleep(250)

  const titleLower = gameTitle.toLowerCase()
  const match = results.find(g => g.name.toLowerCase() === titleLower) ?? results[0]
  return match?.themes?.map(t => t.name.toLowerCase()) ?? []
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SoundTrek Theme Enrichment')
  if (DRY_RUN) console.log('  Mode: DRY RUN')
  if (FORCE)   console.log('  Force: re-enriching already-populated rows')
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const token = await getIGDBToken()

  const query = supabase
    .from('soundtracks')
    .select('id, game_title, theme_tags')
    .limit(LIMIT)

  if (!FORCE) {
    query.or('theme_tags.is.null,theme_tags.eq.{}')
  }

  const { data: toProcess, error } = await query

  if (error) throw error
  if (!toProcess?.length) { console.log('No rows need themes.'); return }

  console.log(`Rows to process: ${toProcess.length}\n`)

  let updated = 0
  let skipped = 0
  let failed  = 0

  for (const row of toProcess) {
    process.stdout.write(`→ ${row.game_title}... `)
    const themes = await fetchIGDBThemes(row.game_title, token)

    if (!themes.length) {
      console.log('not found')
      skipped++
      continue
    }

    console.log(themes.join(', '))

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('soundtracks')
        .update({ theme_tags: themes })
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
