/**
 * SoundTrek Composer Enrichment Script
 *
 * Enriches the soundtracks table with composers via MusicBrainz release-group artist relations.
 *
 * Usage:
 *   npx tsx scripts/enrich-composers.ts
 *   npx tsx scripts/enrich-composers.ts --dry-run
 *   npx tsx scripts/enrich-composers.ts --limit=50
 *   npx tsx scripts/enrich-composers.ts --force   # re-enrich already-populated rows
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

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

function sanitizeForLucene(s: string): string {
  return s.replace(/"/g, '').replace(/[+\-&|!(){}[\]^~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim()
}

function promptLine(question: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(question)
    let input = ''
    const handler = (key: string) => {
      if (key === '') {
        process.stdout.write('\n')
        process.stdin.setRawMode(false)
        process.exit()
      } else if (key === '\r' || key === '\n') {
        process.stdin.removeListener('data', handler)
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdout.write('\n')
        resolve(input)
      } else if (key === '' || key === '\b') {
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
      if (key === '') {
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
  await sleep(1100)
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

  const sorted = [...groups].sort((a, b) => {
    const aScore = (a.title.toLowerCase().startsWith(titleLower) ? 2 : 0)
      + (a['secondary-types']?.includes('Soundtrack') ? 1 : 0)
    const bScore = (b.title.toLowerCase().startsWith(titleLower) ? 2 : 0)
      + (b['secondary-types']?.includes('Soundtrack') ? 1 : 0)
    return bScore - aScore
  })

  console.log('  Fetching MB candidates...')
  const candidates: { rg: MBReleaseGroup; composers: string[] }[] = []
  for (const rg of sorted) {
    const composers = await resolveComposers(rg.id)
    candidates.push({ rg, composers })
  }

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
  console.log('SoundTrek Composer Enrichment')
  if (DRY_RUN) console.log('  Mode: DRY RUN')
  if (FORCE)   console.log('  Force: re-enriching already-populated rows')
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: rows, error } = await supabase
    .from('soundtracks')
    .select('id, game_title, composers')
    .limit(LIMIT)

  if (error) throw error
  if (!rows?.length) { console.log('No rows found.'); return }

  const toProcess = rows.filter(row => FORCE || !row.composers?.length)
  console.log(`Total rows: ${rows.length} | Need composers: ${toProcess.length}\n`)

  let updated = 0
  let failed  = 0

  for (const row of toProcess) {
    console.log(`\n→ ${row.game_title}`)

    const composers = await fetchMBComposers(row.game_title)
    if (!composers.length) {
      console.log('  composers: not found')
      continue
    }

    console.log(`  composers: ${composers.join(', ')}`)

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('soundtracks')
        .update({ composers })
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
