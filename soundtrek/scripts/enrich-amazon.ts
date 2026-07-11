/**
 * SoundTrek — Amazon PA API enrichment script
 *
 * Searches the Amazon Product Advertising API for each soundtrack, applies
 * strict matching, and writes amazon_url + amazon_image_url to Supabase.
 *
 * Requires:
 *   AMAZON_ACCESS_KEY   — AWS access key for PA API
 *   AMAZON_SECRET_KEY   — AWS secret key for PA API
 *   VITE_AMAZON_TAG     — Associates partner tag (e.g. soundtrek-20)
 *
 * Request credentials at: https://affiliate-program.amazon.com/assoc_credentials/home
 *
 * Usage:
 *   npx tsx scripts/enrich-amazon.ts
 *   npx tsx scripts/enrich-amazon.ts --dry-run
 *   npx tsx scripts/enrich-amazon.ts --overwrite   # re-process rows that already have amazon_url
 *   npx tsx scripts/enrich-amazon.ts --reset        # clear not-found progress and restart
 *   npx tsx scripts/enrich-amazon.ts --batch=100
 */

import { createHmac, createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import 'dotenv/config'

const ACCESS_KEY         = requireEnv('AMAZON_ACCESS_KEY')
const SECRET_KEY         = requireEnv('AMAZON_SECRET_KEY')
const PARTNER_TAG        = requireEnv('VITE_AMAZON_TAG')
const SUPABASE_URL       = requireEnv('VITE_SUPABASE_URL')
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY')

const DRY_RUN   = process.argv.includes('--dry-run')
const OVERWRITE = process.argv.includes('--overwrite')
const RESET     = process.argv.includes('--reset')
const BATCH_SIZE = parseInt(
  process.argv.find(a => a.startsWith('--batch='))?.split('=')[1] ?? '200'
)
const PROGRESS_FILE = 'scripts/.progress-amazon.json'

// Minimum score to accept a result. Higher = stricter.
const MIN_SCORE = 6

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env var: ${name}`)
  return val
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

// ── Progress ──────────────────────────────────────────────────────────────────

interface Progress {
  notFoundIds: string[]   // attempted but no match found — skipped on future runs
  lastId: string | null   // cursor for --overwrite mode only
}

function loadProgress(): Progress {
  if (RESET || !existsSync(PROGRESS_FILE)) return { notFoundIds: [], lastId: null }
  try {
    const raw = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'))
    return {
      notFoundIds: Array.isArray(raw.notFoundIds) ? raw.notFoundIds : [],
      lastId: raw.lastId ?? null,
    }
  } catch {
    return { notFoundIds: [], lastId: null }
  }
}

function saveProgress(p: Progress) {
  mkdirSync('scripts', { recursive: true })
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

// ── AWS Signature V4 ──────────────────────────────────────────────────────────

const PA_HOST    = 'webservices.amazon.com'
const PA_PATH    = '/paapi5/searchitems'
const PA_REGION  = 'us-east-1'
const PA_SERVICE = 'ProductAdvertisingAPI'
const PA_TARGET  = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'

function sha256hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

function makeSignedRequest(body: string): { url: string; headers: Record<string, string> } {
  const now = new Date()
  // Format: YYYYMMDDTHHmmssZ
  const amzDate =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    'T' +
    String(now.getUTCHours()).padStart(2, '0') +
    String(now.getUTCMinutes()).padStart(2, '0') +
    String(now.getUTCSeconds()).padStart(2, '0') +
    'Z'
  const dateStamp = amzDate.slice(0, 8)

  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type':     'application/json; charset=UTF-8',
    'host':             PA_HOST,
    'x-amz-date':       amzDate,
    'x-amz-target':     PA_TARGET,
  }

  // Canonical request (headers must be sorted)
  const sortedKeys    = Object.keys(headers).sort()
  const canonHeaders  = sortedKeys.map(k => `${k}:${headers[k]}`).join('\n') + '\n'
  const signedHeaders = sortedKeys.join(';')
  const payloadHash   = sha256hex(body)

  const canonRequest = ['POST', PA_PATH, '', canonHeaders, signedHeaders, payloadHash].join('\n')

  // String to sign
  const credScope   = `${dateStamp}/${PA_REGION}/${PA_SERVICE}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, sha256hex(canonRequest)].join('\n')

  // Signing key
  const kDate    = hmac(Buffer.from('AWS4' + SECRET_KEY), dateStamp)
  const kRegion  = hmac(kDate, PA_REGION)
  const kService = hmac(kRegion, PA_SERVICE)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')

  headers['Authorization'] =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return { url: `https://${PA_HOST}${PA_PATH}`, headers }
}

// ── PA API search ─────────────────────────────────────────────────────────────

interface PAItem {
  ASIN: string
  DetailPageURL: string
  ItemInfo?: {
    Title?: { DisplayValue?: string }
    ByLineInfo?: { Brand?: { DisplayValue?: string } }
  }
  Images?: {
    Primary?: {
      Large?: { URL?: string }
    }
  }
}

interface PAResponse {
  SearchResult?: { Items?: PAItem[] }
  Errors?: { Code: string; Message: string }[]
}

async function searchPA(keywords: string): Promise<PAItem[]> {
  const body = JSON.stringify({
    Keywords:    keywords,
    Resources:   ['Images.Primary.Large', 'ItemInfo.Title', 'ItemInfo.ByLineInfo'],
    SearchIndex: 'Music',
    PartnerTag:  PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    ItemCount:   5,
  })

  const { url, headers } = makeSignedRequest(body)

  const res = await fetch(url, { method: 'POST', headers, body })

  if (res.status === 429) {
    const retry = Number(res.headers.get('Retry-After') ?? '5')
    console.log(`\n  [429] Retrying after ${retry}s...`)
    await sleep(retry * 1000)
    return searchPA(keywords) // single retry
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PA API ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as PAResponse
  if (data.Errors?.length) {
    const err = data.Errors[0]
    if (err.Code === 'NoResults') return []
    throw new Error(`PA API error: ${err.Code} — ${err.Message}`)
  }

  return data.SearchResult?.Items ?? []
}

// ── Matching ──────────────────────────────────────────────────────────────────

const BAD_KEYWORDS = [
  'cover', 'tribute', 'piano', 'remix', 'arrangement', 'arranged',
  'inspired by', 'karaoke', 'medley', 'orchestral version', 'chiptune',
  'lofi', 'lo-fi', 'jazz',
]

const OST_KEYWORDS = [
  'original soundtrack', 'original game soundtrack', 'original score',
  'music from', ' ost ', '(ost)', '[ost]', 'game soundtrack',
]

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function scoreItem(item: PAItem, gameTitle: string): number {
  const rawTitle = item.ItemInfo?.Title?.DisplayValue ?? ''
  const title    = normalize(rawTitle)
  const game     = normalize(gameTitle)

  // Hard reject: no usable title or image
  if (!rawTitle || !item.Images?.Primary?.Large?.URL) return -1

  // Hard reject: bad keywords
  if (BAD_KEYWORDS.some(b => title.includes(b))) return -1

  let score = 0

  // Game title presence (required — zero score if missing)
  if (title === game) {
    score += 5
  } else if (title.startsWith(game)) {
    score += 4
  } else if (title.includes(game)) {
    score += 3
  } else {
    // Check all significant words are present
    const words = game.split(' ').filter(w => w.length > 3)
    if (words.length > 0 && words.every(w => title.includes(w))) {
      score += 2
    } else {
      return -1 // Game title not recognisable in result — hard reject
    }
  }

  // OST keyword presence (required for high confidence)
  if (OST_KEYWORDS.some(k => title.includes(k))) {
    score += 4
  } else if (title.includes('soundtrack')) {
    score += 2
  } else {
    score -= 2 // No soundtrack indicator — reduce confidence
  }

  return score
}

interface BestMatch {
  asin: string
  url: string
  imageUrl: string
  title: string
  score: number
}

async function findBestMatch(gameTitle: string): Promise<BestMatch | null> {
  const queries = [
    `${gameTitle} original soundtrack`,
    `${gameTitle} game soundtrack`,
  ]

  let best: BestMatch | null = null

  for (const q of queries) {
    let items: PAItem[]
    try {
      items = await searchPA(q)
    } catch (err) {
      throw err
    }

    for (const item of items) {
      const score = scoreItem(item, gameTitle)
      if (score < MIN_SCORE) continue
      if (!best || score > best.score) {
        best = {
          asin:     item.ASIN,
          url:      `https://www.amazon.com/dp/${item.ASIN}?tag=${PARTNER_TAG}`,
          imageUrl: item.Images!.Primary!.Large!.URL!,
          title:    item.ItemInfo?.Title?.DisplayValue ?? '',
          score,
        }
      }
    }

    // If we already have a high-confidence result, skip second query
    if (best && best.score >= 8) break

    // PA API rate limit: 1 request/sec
    await sleep(1100)
  }

  return best
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('SoundTrek — Amazon Enrichment')
  console.log(`  Min score  : ${MIN_SCORE}`)
  if (DRY_RUN)   console.log('  Mode       : DRY RUN')
  if (OVERWRITE) console.log('  Overwrite  : yes')
  if (RESET)     console.log('  Progress   : reset')
  console.log('')

  const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const progress  = loadProgress()
  const notFoundSet = new Set(progress.notFoundIds)

  if (OVERWRITE && progress.lastId) console.log(`Resuming after ID: ${progress.lastId}`)
  if (!OVERWRITE && notFoundSet.size > 0) console.log(`Skipping ${notFoundSet.size} previously not-found rows.`)

  let query = supabase
    .from('soundtracks')
    .select('id, game_title')
    .order('id')
    .limit(OVERWRITE ? BATCH_SIZE : BATCH_SIZE + notFoundSet.size + 50)

  if (!OVERWRITE) {
    query = query.is('amazon_url', null)
  } else if (progress.lastId) {
    query = query.gt('id', progress.lastId)
  }

  const { data: allRows, error } = await query
  if (error) throw error

  const rows = OVERWRITE
    ? (allRows ?? [])
    : (allRows ?? []).filter(r => !notFoundSet.has(r.id)).slice(0, BATCH_SIZE)

  if (!rows.length) {
    console.log('Nothing to process.')
    return
  }

  console.log(`Rows to process: ${rows.length}\n`)

  let updated  = 0
  let notFound = 0
  let failed   = 0

  for (const row of rows) {
    process.stdout.write(`→ ${row.game_title}... `)

    let match: BestMatch | null = null
    try {
      match = await findBestMatch(row.game_title)
    } catch (err) {
      console.log(`[ERROR: ${(err as Error).message}]`)
      failed++
      if (OVERWRITE) { progress.lastId = row.id; saveProgress(progress) }
      continue
    }

    if (!match) {
      console.log('no match')
      notFound++
      if (!OVERWRITE) { progress.notFoundIds.push(row.id); saveProgress(progress) }
    } else {
      console.log(`score=${match.score} "${match.title}"`)

      if (!DRY_RUN) {
        const { error: updateErr } = await supabase
          .from('soundtracks')
          .update({ amazon_url: match.url, amazon_image_url: match.imageUrl })
          .eq('id', row.id)

        if (updateErr) {
          console.log(`  FAILED: ${updateErr.message}`)
          failed++
        } else {
          updated++
        }
      } else {
        console.log(`  → ${match.url}`)
        updated++
      }
    }

    if (OVERWRITE) { progress.lastId = row.id; saveProgress(progress) }
  }

  const { count: remaining } = await supabase
    .from('soundtracks')
    .select('id', { count: 'exact', head: true })
    .is('amazon_url', null)

  console.log(`
────────────────────────────────
Updated    : ${updated}
No match   : ${notFound}
Failed     : ${failed}
Remaining  : ${remaining ?? '?'} without Amazon link
────────────────────────────────${(remaining ?? 0) > 0 ? '\nRun again to continue.' : '\nAll done!'}
`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
