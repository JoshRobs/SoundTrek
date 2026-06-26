/**
 * SoundTrek Bio Enrichment Script
 *
 * Looks up each unique composer from the soundtracks table, finds their
 * Wikipedia page via MusicBrainz URL relations, fetches the extract, and
 * upserts it into the composers table.
 *
 * Usage:
 *   npx tsx scripts/enrich-bios.ts
 *   npx tsx scripts/enrich-bios.ts --dry-run
 *   npx tsx scripts/enrich-bios.ts --limit=50
 *   npx tsx scripts/enrich-bios.ts --force   # re-enrich already-populated bios
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL         = requireEnv('VITE_SUPABASE_URL')
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY')

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE   = process.argv.includes('--force')
const LIMIT   = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '200')

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env var: ${name}`)
  return val
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Input ─────────────────────────────────────────────────────────────────────

function promptKey(question: string, validKeys: string[]): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(question)
    const handler = (key: string) => {
      if (key === '') {
        process.stdout.write('\n')
        process.stdin.setRawMode(false)
        process.exit()
      }
      const ch = key.toLowerCase()
      if (!validKeys.includes(ch)) return
      process.stdin.removeListener('data', handler)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      // Show 'y' for Enter so the output reads naturally
      process.stdout.write((ch === '\r' || ch === '\n' ? 'y' : ch) + '\n')
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

interface MBArtist {
  id: string
  name: string
}

interface MBUrlRel {
  type: string
  url: { resource: string }
}

async function findWikipediaTitle(composerName: string): Promise<string | null> {
  const searchData = await mbGet<{ artists: MBArtist[] }>(
    `https://musicbrainz.org/ws/2/artist?query=artist:${encodeURIComponent(`"${composerName}"`)}&limit=3&fmt=json`,
  )

  const artists = searchData?.artists ?? []
  if (!artists.length) return null

  const nameLower = composerName.toLowerCase()
  const best = artists.find(a => a.name.toLowerCase() === nameLower) ?? artists[0]

  const artistData = await mbGet<{ relations?: MBUrlRel[] }>(
    `https://musicbrainz.org/ws/2/artist/${best.id}?inc=url-rels&fmt=json`,
  )

  const relations = artistData?.relations ?? []

  // Direct English Wikipedia link (regardless of relationship type label)
  const wikiRel = relations.find(r => r.url.resource.includes('en.wikipedia.org'))
  if (wikiRel) {
    const match = wikiRel.url.resource.match(/\/wiki\/(.+)$/)
    if (match) return decodeURIComponent(match[1])
  }

  // Wikidata link — resolve to English Wikipedia sitelink
  const wikidataRel = relations.find(r => r.url.resource.includes('wikidata.org/wiki/'))
  if (wikidataRel) {
    const qMatch = wikidataRel.url.resource.match(/\/(Q\d+)$/)
    if (qMatch) {
      const title = await resolveWikidataTitle(qMatch[1])
      if (title) return title
    }
  }

  return null
}

async function resolveWikidataTitle(entityId: string): Promise<string | null> {
  await sleep(300)
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=sitelinks&sitefilter=enwiki&format=json`,
      { headers: { 'User-Agent': 'SoundTrek/1.0 (https://soundtrek.app)' } },
    )
    if (!res.ok) return null
    const data = await res.json() as {
      entities?: Record<string, { sitelinks?: { enwiki?: { title: string } } }>
    }
    return data.entities?.[entityId]?.sitelinks?.enwiki?.title ?? null
  } catch {
    return null
  }
}

// ── Wikipedia ─────────────────────────────────────────────────────────────────

async function fetchWikiBio(pageTitle: string): Promise<string | null> {
  await sleep(300)
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
      { headers: { 'User-Agent': 'SoundTrek/1.0 (https://soundtrek.app)' } },
    )
    if (!res.ok) return null
    const data = await res.json() as { extract?: string; type?: string; title?: string }
    if (data.type === 'disambiguation') return null
    return data.extract ?? null
  } catch {
    return null
  }
}

async function searchWikipediaTitle(name: string): Promise<string | null> {
  // Try direct page lookup first — works when the article title matches the name exactly
  await sleep(300)
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      { headers: { 'User-Agent': 'SoundTrek/1.0 (https://soundtrek.app)' } },
    )
    if (res.ok) {
      const data = await res.json() as { type?: string; title?: string; extract?: string }
      if (data.type !== 'disambiguation' && data.extract) return data.title ?? null
    }
  } catch {}

  // Fall back to the Wikipedia search API
  await sleep(300)
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srnamespace=0&srlimit=3&format=json`,
      { headers: { 'User-Agent': 'SoundTrek/1.0 (https://soundtrek.app)' } },
    )
    if (!res.ok) return null
    const data = await res.json() as { query?: { search?: Array<{ title: string }> } }
    return data.query?.search?.[0]?.title ?? null
  } catch {
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SoundTrek Bio Enrichment')
  if (DRY_RUN) console.log('  Mode: DRY RUN')
  if (FORCE)   console.log('  Force: re-enriching already-populated bios')
  console.log('')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: soundtracks, error: stErr } = await supabase
    .from('soundtracks')
    .select('composers')
  if (stErr) throw stErr

  const allNames = [...new Set(
    (soundtracks ?? []).flatMap((s: { composers?: string[] }) => s.composers ?? []),
  )].sort() as string[]

  const { data: existing, error: cErr } = await supabase
    .from('composers')
    .select('slug, bio')
  if (cErr) throw cErr

  const hasBio = new Set(
    (existing ?? []).filter((c: { bio: string | null }) => c.bio).map((c: { slug: string }) => c.slug),
  )

  const toProcess = allNames
    .filter(name => FORCE || !hasBio.has(toSlug(name)))
    .slice(0, LIMIT)

  console.log(`Unique composers: ${allNames.length} | Need bios: ${toProcess.length}\n`)

  let saved   = 0
  let skipped = 0
  let failed  = 0

  for (const name of toProcess) {
    console.log(`\n→ ${name}`)

    process.stdout.write('  MusicBrainz lookup...')
    let wikiTitle = await findWikipediaTitle(name)
    let source = 'MusicBrainz'
    if (!wikiTitle) {
      console.log(' not found')
      process.stdout.write('  Wikipedia search...')
      wikiTitle = await searchWikipediaTitle(name)
      source = 'Wikipedia'
    }
    if (!wikiTitle) {
      console.log(' not found')
      skipped++
      continue
    }
    console.log(` → "${wikiTitle}" (via ${source})`)

    const bio = await fetchWikiBio(wikiTitle)
    if (!bio) {
      console.log('  No Wikipedia extract found')
      skipped++
      continue
    }

    const preview = bio.length > 220 ? bio.slice(0, 220).trimEnd() + '…' : bio
    console.log(`  ${preview}`)

    // Enter or Y to save, N to skip
    const key = await promptKey('  Save? [Y/n] ', ['y', 'n', '\r', '\n'])
    if (key === 'n') {
      skipped++
      continue
    }

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('composers')
        .upsert({ slug: toSlug(name), name, bio }, { onConflict: 'slug' })
      if (error) {
        console.log(`  FAILED: ${error.message}`)
        failed++
      } else {
        console.log('  ✓ saved')
        saved++
      }
    } else {
      console.log('  (dry run)')
      saved++
    }
  }

  console.log(`
────────────────────────────────
Saved:   ${saved}
Skipped: ${skipped}
Failed:  ${failed}
────────────────────────────────`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
