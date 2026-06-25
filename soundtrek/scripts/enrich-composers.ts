/**
 * SoundTrek Enrichment Script
 *
 * Enriches the soundtracks table with:
 *   - theme_tags  via IGDB /v4/games (themes field)
 *   - composers   via MusicBrainz release-group artist relations
 *
 * Usage:
 *   npx tsx scripts/enrich-composers.ts
 *   npx tsx scripts/enrich-composers.ts --dry-run
 *   npx tsx scripts/enrich-composers.ts --limit=50
 *   npx tsx scripts/enrich-composers.ts --force           # re-enrich already-populated rows
 *   npx tsx scripts/enrich-composers.ts --skip-themes     # composers only
 *   npx tsx scripts/enrich-composers.ts --skip-composers  # themes only
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const TWITCH_CLIENT_ID     = requireEnv('TWITCH_CLIENT_ID')
const TWITCH_CLIENT_SECRET = requireEnv('TWITCH_CLIENT_SECRET')
const SUPABASE_URL         = requireEnv('VITE_SUPABASE_URL')
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY')

const DRY_RUN        = process.argv.includes('--dry-run')
const FORCE          = process.argv.includes('--force')
const SKIP_THEMES    = process.argv.includes('--skip-themes')
const SKIP_COMPOSERS = process.argv.includes('--skip-composers')
const LIMIT          = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '500')

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

function sanitizeForLucene(s: string): string {
  // Strip characters that break Lucene query parsing; we wrap in quotes instead of escaping
  return s.replace(/"/g, '').replace(/[+\-&|!(){}[\]^~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim()
}

function promptLine(question: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(question)
    let input = ''
    const handler = (key: string) => {
      if (key === '') { // Ctrl+C
        process.stdout.write('\n')
        process.stdin.setRawMode(false)
        process.exit()
      } else if (key === '\r' || key === '\n') {
        process.stdin.removeListener('data', handler)
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdout.write('\n')
        resolve(input)
      } else if (key === '' || key === '\b') { // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1)
          process.stdout.write('\b \b')
        }
      } else {
        input += key
        process.stdout.write(key)
      }
    }
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', handler)
  })
}

function promptKey(question: string, validKeys: string[]): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(question)
    const handler = (key: string) => {
      if (key === '') { // Ctrl+C
        process.stdout.write('\n')
        process.stdin.setRawMode(false)
        process.exit()
      }
      const ch = key.toLowerCase()
      if (!validKeys.includes(ch)) return
      process.stdin.removeListener('data', handler)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write(ch + '\n')
      resolve(ch)
    }
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', handler)
  })
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
  // Exact match first
  const exact = await igdbPost(
    'games',
    `fields name, themes.name; where name = "${escapeIgdb(gameTitle)}"; limit 1;`,
    token,
  )
  await sleep(250)

  if (exact[0]?.themes?.length) {
    return exact[0].themes.map(t => t.name.toLowerCase())
  }

  // Fall back to IGDB search
  const results = await igdbPost(
    'games',
    `search "${escapeIgdb(gameTitle)}"; fields name, themes.name; limit 5;`,
    token,
  )
  await sleep(250)

  const titleLower = gameTitle.toLowerCase()
  const match =
    results.find(g => g.name.toLowerCase() === titleLower) ?? results[0]

  return match?.themes?.map(t => t.name.toLowerCase()) ?? []
}

// ── MusicBrainz ───────────────────────────────────────────────────────────────

const MB_HEADERS = {
  'User-Agent': 'SoundTrek/1.0 (https://soundtrek.app)',
  Accept: 'application/json',
}

interface MBReleaseGroup {
  id: string
  title: string
  score: number
  'primary-type'?: string
  'secondary-types'?: string[]
}

interface MBArtistRel {
  type: string
  artist: { name: string }
}

interface MBArtistCredit {
  artist: { name: string }
  name: string
}

async function mbGet<T>(url: string): Promise<T | null> {
  await sleep(1100) // MusicBrainz requires max 1 req/sec
  try {
    const res = await fetch(url, { headers: MB_HEADERS })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

const VARIOUS = ['Various Artists', 'Various', 'Unknown']

async function resolveComposers(rgId: string): Promise<string[]> {
  const rgData = await mbGet<{
    relations?: MBArtistRel[]
    'artist-credit'?: MBArtistCredit[]
    releases?: { id: string }[]
  }>(
    `https://musicbrainz.org/ws/2/release-group/${rgId}?inc=artist-credits%2Bartist-rels%2Breleases&fmt=json`,
  )

  const relComposers = (rgData?.relations ?? [])
    .filter(r => r.type === 'composer')
    .map(r => r.artist.name)
  if (relComposers.length) return [...new Set(relComposers)]

  const creditComposers = (rgData?.['artist-credit'] ?? [])
    .map(c => c.artist.name)
    .filter(name => !VARIOUS.includes(name))
  if (creditComposers.length) return [...new Set(creditComposers)]

  const firstReleaseId = rgData?.releases?.[0]?.id
  if (!firstReleaseId) return []

  const releaseData = await mbGet<{
    relations?: MBArtistRel[]
    'artist-credit'?: MBArtistCredit[]
  }>(
    `https://musicbrainz.org/ws/2/release/${firstReleaseId}?inc=artist-credits%2Bartist-rels&fmt=json`,
  )

  const releaseRelComposers = (releaseData?.relations ?? [])
    .filter(r => r.type === 'composer')
    .map(r => r.artist.name)
  if (releaseRelComposers.length) return [...new Set(releaseRelComposers)]

  return [...new Set(
    (releaseData?.['artist-credit'] ?? [])
      .map(c => c.artist.name)
      .filter(name => !VARIOUS.includes(name))
  )]
}

async function fetchMBComposers(gameTitle: string): Promise<string[]> {
  const title = sanitizeForLucene(gameTitle)
  const titleLower = gameTitle.toLowerCase()

  const searchData = await mbGet<{ 'release-groups': MBReleaseGroup[] }>(
    `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(`releasegroup:"${title}"`)}&limit=5&fmt=json`,
  )

  const groups = searchData?.['release-groups'] ?? []
  if (!groups.length) return []

  // Sort: starts-with matches first, then soundtrack preference
  const sorted = [...groups].sort((a, b) => {
    const aScore = (a.title.toLowerCase().startsWith(titleLower) ? 2 : 0)
      + (a['secondary-types']?.includes('Soundtrack') ? 1 : 0)
    const bScore = (b.title.toLowerCase().startsWith(titleLower) ? 2 : 0)
      + (b['secondary-types']?.includes('Soundtrack') ? 1 : 0)
    return bScore - aScore
  })

  // Fetch composers for every candidate up front
  console.log('  Fetching MB candidates...')
  const candidates: { rg: MBReleaseGroup; composers: string[] }[] = []
  for (const rg of sorted) {
    const composers = await resolveComposers(rg.id)
    candidates.push({ rg, composers })
  }

  // Display numbered list
  candidates.forEach(({ rg, composers }, i) => {
    const types = [rg['primary-type'], ...(rg['secondary-types'] ?? [])].filter(Boolean).join(', ')
    const composerStr = composers.length ? composers.join(', ') : 'none found'
    console.log(`  [${i + 1}] "${rg.title}" [${types}] — ${composerStr}`)
  })

  const validKeys = ['n', ...candidates.map((_, i) => String(i + 1))]
  const key = await promptKey(`  Pick [1-${candidates.length}] or N to enter manually: `, validKeys)
  if (key === 'n') {
    const manual = await promptLine('  Composer(s): ')
    return manual.split(',').map(s => s.trim()).filter(Boolean)
  }

  const idx = parseInt(key) - 1
  if (isNaN(idx) || idx < 0 || idx >= candidates.length) return []

  return candidates[idx].composers
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SoundTrek Enrichment')
  console.log(`  Themes:    ${SKIP_THEMES    ? 'skip' : 'IGDB'}`)
  console.log(`  Composers: ${SKIP_COMPOSERS ? 'skip' : 'MusicBrainz'}`)
  if (DRY_RUN) console.log('  Mode: DRY RUN')
  if (FORCE)   console.log('  Force: re-enriching already-populated rows')
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const igdbToken = SKIP_THEMES ? null : await getIGDBToken()
  const { data: rows, error } = await supabase
    .from('soundtracks')
    .select('id, game_title, theme_tags, composers')
    .limit(LIMIT)

  if (error) throw error
  if (!rows?.length) { console.log('No rows found.'); return }

  const toProcess = rows.filter(row => {
    const needsThemes    = !SKIP_THEMES    && (FORCE || !row.theme_tags?.length)
    const needsComposers = !SKIP_COMPOSERS && (FORCE || !row.composers?.length)
    return needsThemes || needsComposers
  })

  console.log(`Total rows: ${rows.length} | Need enrichment: ${toProcess.length}\n`)

  let updated = 0
  let failed  = 0

  for (const row of toProcess) {
    console.log(`\n→ ${row.game_title}`)

    const patch: { theme_tags?: string[]; composers?: string[] } = {}

    if (!SKIP_THEMES && (FORCE || !row.theme_tags?.length)) {
      const themes = await fetchIGDBThemes(row.game_title, igdbToken!)
      if (themes.length) {
        patch.theme_tags = themes
        console.log(`  themes: ${themes.join(', ')}`)
      } else {
        console.log('  themes: not found')
      }
    }

    if (!SKIP_COMPOSERS && (FORCE || !row.composers?.length)) {
      const composers = await fetchMBComposers(row.game_title)
      if (composers.length) {
        patch.composers = composers
        console.log(`  composers: ${composers.join(', ')}`)
      } else {
        console.log('  composers: not found')
      }
    }

    if (!Object.keys(patch).length) {
      console.log('  (nothing to update)')
      continue
    }

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('soundtracks')
        .update(patch)
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

  console.log(`
────────────────────────────────
Updated: ${updated}
Failed:  ${failed}
────────────────────────────────`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
