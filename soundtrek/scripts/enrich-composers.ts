/**
 * Enriches composer names in the soundtracks table using VGMdb.
 *
 * IGDB doesn't store individual composers — the main ingest script falls back
 * to the developer studio name. This script searches VGMdb by game title and
 * patches the composer field where it finds a match.
 *
 * VGMdb has an unofficial API (not supported by vgmdb.net themselves — use
 * it respectfully with delays). Coverage is excellent for released OSTs.
 *
 * Usage:
 *   npx tsx scripts/enrich-composers.ts
 *   npx tsx scripts/enrich-composers.ts --dry-run
 *   npx tsx scripts/enrich-composers.ts --limit=50
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL        = requireEnv('VITE_SUPABASE_URL')
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY')

const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT   = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '100')

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required env var: ${name}`)
  return val
}

// ── VGMdb ─────────────────────────────────────────────────────────────────────

interface VGMdbSearchResult {
  results?: {
    games?: { link: string; titles: { en?: string } }[]
    albums?: { link: string; titles: { en?: string }; performers: string[]; composers: string[] }[]
  }
}

interface VGMdbAlbum {
  link: string
  composers?: { names: { en?: string } }[]
  performers?: { names: { en?: string } }[]
  titles?: { en?: string }
}

async function searchVGMdb(gameTitle: string): Promise<string | null> {
  await sleep(800) // VGMdb rate limit — be respectful

  const url = `https://vgmdb.info/search?q=${encodeURIComponent(gameTitle)}&format=json`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'SoundTrek/1.0 (game soundtrack discovery app)' }
    })
  } catch {
    return null
  }

  if (!res.ok) return null

  const data = await res.json() as VGMdbSearchResult
  const albums = data.results?.albums ?? []

  if (!albums.length) return null

  const titleLower = gameTitle.toLowerCase()
  const match = albums.find(a =>
    a.titles?.en?.toLowerCase().includes(titleLower) ||
    a.titles?.en?.toLowerCase().includes('original soundtrack') ||
    a.titles?.en?.toLowerCase().includes('ost')
  ) ?? albums[0]

  if (!match?.link) return null

  await sleep(500)
  const albumUrl = `https://vgmdb.info/${match.link}?format=json`
  let albumRes: Response
  try {
    albumRes = await fetch(albumUrl, {
      headers: { 'User-Agent': 'SoundTrek/1.0 (game soundtrack discovery app)' }
    })
  } catch {
    return null
  }

  if (!albumRes.ok) return null

  const album = await albumRes.json() as VGMdbAlbum

  const composers = album.composers
    ?.map(c => c.names?.en)
    .filter(Boolean) as string[] | undefined

  if (composers?.length) {
    return composers.join(', ')
  }

  // Fall back to performers if no explicit composers listed
  const performers = album.performers
    ?.map(p => p.names?.en)
    .filter(Boolean) as string[] | undefined

  return performers?.join(', ') ?? null
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SoundTrek Composer Enrichment (VGMdb)')
  if (DRY_RUN) console.log('  Mode: DRY RUN\n')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: rows, error } = await supabase
    .from('soundtracks')
    .select('id, game_title, studio, composers')
    .limit(LIMIT)

  if (error) throw error
  if (!rows?.length) { console.log('No rows found.'); return }

  console.log(`Processing ${rows.length} soundtracks\n`)

  let updated  = 0
  let notFound = 0

  for (const row of rows) {
    const currentComposers: string[] = row.composers ?? []
    process.stdout.write(`→ ${row.game_title} (studio: ${row.studio}) `)

    const composerResult = await searchVGMdb(row.game_title)

    if (!composerResult) {
      console.log('[not found]')
      notFound++
      continue
    }

    // VGMdb returns a comma-separated string; split into array
    const composers = composerResult.split(',').map((c: string) => c.trim()).filter(Boolean)

    if (JSON.stringify(composers) === JSON.stringify(currentComposers)) {
      console.log('[unchanged]')
      continue
    }

    console.log(`→ ${composers.join(', ')}`)

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('soundtracks')
        .update({ composers })
        .eq('id', row.id)

      if (updateError) {
        console.error(`  Update failed: ${updateError.message}`)
      } else {
        updated++
      }
    } else {
      updated++
    }
  }

  console.log(`
────────────────────────────────
Updated  : ${updated}
Not found: ${notFound}
────────────────────────────────`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
