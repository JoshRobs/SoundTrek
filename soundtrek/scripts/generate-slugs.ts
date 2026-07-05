/**
 * SoundTrek — Slug generation script
 *
 * Backfills the `slug` column on all soundtracks rows that don't have one.
 * Safe to re-run — skips rows that already have a slug.
 *
 * Run AFTER adding the column in Supabase:
 *   ALTER TABLE soundtracks ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
 *
 * Usage:
 *   npx tsx scripts/generate-slugs.ts
 *   npx tsx scripts/generate-slugs.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL         = requireEnv('VITE_SUPABASE_URL')
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY')
const DRY_RUN              = process.argv.includes('--dry-run')

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env var: ${name}`)
  return val
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[''']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  console.log('SoundTrek — Slug Generation')
  if (DRY_RUN) console.log('  Mode: DRY RUN (no writes)\n')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Paginate to avoid Supabase's 1000-row default limit
  const PAGE = 1000
  let rows: { id: string; game_title: string; release_year: number; slug: string | null }[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('soundtracks')
      .select('id, game_title, release_year, slug')
      .is('slug', null)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows = rows.concat(data ?? [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }

  if (!rows.length) { console.log('No rows need slugs.'); return }

  console.log(`Rows to process: ${rows.length}\n`)

  // Load all existing slugs (paginated) to detect collisions
  let existingSlugs: string[] = []
  from = 0
  while (true) {
    const { data } = await supabase
      .from('soundtracks')
      .select('slug')
      .not('slug', 'is', null)
      .range(from, from + PAGE - 1)
    existingSlugs = existingSlugs.concat((data ?? []).map(r => r.slug as string))
    if (!data || data.length < PAGE) break
    from += PAGE
  }

  const taken = new Set(existingSlugs)

  let updated = 0
  let failed  = 0

  for (const row of rows) {
    const base = toSlug(row.game_title)
    let slug   = base

    // Collision: append release year
    if (taken.has(slug)) slug = `${base}-${row.release_year}`
    // Still colliding: append first 6 chars of ID
    if (taken.has(slug)) slug = `${base}-${row.id.slice(0, 6)}`

    taken.add(slug)
    process.stdout.write(`→ "${row.game_title}" → ${slug} `)

    if (!DRY_RUN) {
      const { error: updateErr } = await supabase
        .from('soundtracks')
        .update({ slug })
        .eq('id', row.id)

      if (updateErr) {
        console.log(`FAILED (${updateErr.message})`)
        failed++
      } else {
        console.log('✓')
        updated++
      }
    } else {
      console.log('(dry run)')
      updated++
    }
  }

  console.log(`\n────────────────────────────────`)
  console.log(`Updated : ${updated}`)
  console.log(`Failed  : ${failed}`)
  console.log(`────────────────────────────────`)
}

main().catch(e => { console.error(e); process.exit(1) })
