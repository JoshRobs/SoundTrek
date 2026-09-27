/**
 * SoundTrek — Loaded price sync
 *
 * Pulls Loaded's USD product catalog from the Impact partner API and writes
 * the current/original price onto every soundtrack whose loaded_url points at
 * a catalog product. Products that have left the catalog get their price
 * cleared (the link itself is kept). Meant to run daily — SoundtrackView hides
 * any price older than 48h, so a stalled sync degrades to a plain link rather
 * than a wrong price.
 *
 * With --match it also fills loaded_url for soundtracks that don't have one,
 * by strict game-title matching against catalog product names (preferring the
 * base game on Steam, worldwide, in stock). Review with --match --dry-run
 * first; bad matches can be fixed or cleared in the admin Edit page.
 *
 * Requires:
 *   IMPACT_ACCOUNT_SID   — Impact partner Account SID
 *   IMPACT_AUTH_TOKEN    — Impact API auth token
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *
 * Usage:
 *   npx tsx scripts/sync-loaded.ts
 *   npx tsx scripts/sync-loaded.ts --dry-run
 *   npx tsx scripts/sync-loaded.ts --match              # also auto-link unlinked soundtracks
 *   npx tsx scripts/sync-loaded.ts --match --dry-run    # preview the matches
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const IMPACT_SID = requireEnv("IMPACT_ACCOUNT_SID");
const IMPACT_TOKEN = requireEnv("IMPACT_AUTH_TOKEN");
const SUPABASE_URL = requireEnv("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_KEY = requireEnv("SUPABASE_SERVICE_KEY");

const DRY_RUN = process.argv.includes("--dry-run");
const MATCH = process.argv.includes("--match");

// Loaded publishes USD, GBP and EUR catalogs; USD is the one we display.
const CATALOG_CURRENCY = "USD";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Impact catalog ────────────────────────────────────────────────────────────

interface ImpactCatalog {
  Id: string;
  AdvertiserName: string;
  Currency: string;
}

interface ImpactItem {
  Name: string;
  Url: string; // go.loaded.com tracking link, destination in its `u` param
  CurrentPrice: string;
  OriginalPrice: string;
  Currency: string;
  StockAvailability: string; // "InStock" | "PreOrder" | …
  Category: string; // e.g. "PC > Games", "PC > Time Cards & DLC"
  Text1: string; // region, e.g. "Worldwide"
  Text3: string; // platform, e.g. "Steam"
}

interface CatalogProduct {
  name: string;
  pageUrl: string; // plain loaded.com product page, no query string
  price: number;
  originalPrice: number | null;
  currency: string;
  stock: string;
  category: string;
  region: string;
  platform: string;
}

const IMPACT_API = "https://api.impact.com";
const impactAuth =
  "Basic " + Buffer.from(`${IMPACT_SID}:${IMPACT_TOKEN}`).toString("base64");

async function impactGet<T>(uri: string): Promise<T> {
  const res = await fetch(`${IMPACT_API}${uri}`, {
    headers: { Authorization: impactAuth, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Impact ${res.status} on ${uri}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function destinationOf(trackingUrl: string): string | null {
  try {
    const dest = new URL(trackingUrl).searchParams.get("u");
    if (!dest) return null;
    const u = new URL(dest);
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

async function loadCatalog(): Promise<CatalogProduct[]> {
  const { Catalogs } = await impactGet<{ Catalogs: ImpactCatalog[] }>(
    `/Mediapartners/${IMPACT_SID}/Catalogs`,
  );
  const catalog = Catalogs.find(
    (c) => c.AdvertiserName === "Loaded" && c.Currency === CATALOG_CURRENCY,
  );
  if (!catalog) throw new Error(`No Loaded ${CATALOG_CURRENCY} catalog on this Impact account`);

  const products: CatalogProduct[] = [];
  let uri: string | null =
    `/Mediapartners/${IMPACT_SID}/Catalogs/${catalog.Id}/Items?PageSize=1000`;
  while (uri) {
    const page: { Items: ImpactItem[]; "@nextpageuri": string } =
      await impactGet(uri);
    for (const item of page.Items) {
      const pageUrl = destinationOf(item.Url);
      const price = parseFloat(item.CurrentPrice);
      if (!pageUrl || !Number.isFinite(price)) continue;
      const original = parseFloat(item.OriginalPrice);
      products.push({
        name: item.Name,
        pageUrl,
        price,
        originalPrice: Number.isFinite(original) ? original : null,
        currency: item.Currency || catalog.Currency,
        stock: item.StockAvailability,
        category: item.Category,
        region: item.Text1,
        platform: item.Text3,
      });
    }
    uri = page["@nextpageuri"] || null;
  }
  return products;
}

// Catalog lookups key on the product page path, so a stored loaded_url matches
// regardless of scheme, www, trailing slash or query string.
function pageKey(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)loaded\.com$/i.test(u.hostname)) return null;
    return u.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return null;
  }
}

// ── Title matching (--match) ──────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Trailing platform/format descriptors on catalog names, e.g.
// "Elden Ring PC (US/Mexico)", "Minecraft Xbox One & Xbox Series X|S (WW)",
// "Minecraft Dungeons - Windows 10 PC". Stripped repeatedly until stable.
const PLATFORM_SUFFIXES = [
  /\s*\([^)]*\)\s*$/,
  /\s*-?\s*\bdlc\b\s*$/i,
  /\s*-?\s*\b(pc|mac|windows(\s*10)?|steam|gog|epic|ea app|origin|ubisoft connect)\b\s*$/i,
  /\s*-?\s*\bxbox(\s*one)?(\s*[&/,]\s*xbox)?(\s*series\s*x\s*[|/]\s*s)?(\s*[&/]\s*pc)?\s*$/i,
  /\s*-?\s*\b(ps4|ps5|playstation\s*\d?|nintendo\s*switch(\s*2)?|switch(\s*2)?)\b(\s*[&/]\s*(ps4|ps5))?\s*$/i,
  // Multi-word only — single words like "Us" or "Key" end real titles.
  /\s*-?\s*\b(online game code|cd key)\b\s*$/i,
  /\s*[-–:]\s*$/,
];

function baseTitle(productName: string): string {
  let s = productName.trim();
  for (let prev = ""; prev !== s; ) {
    prev = s;
    for (const re of PLATFORM_SUFFIXES) s = s.replace(re, "");
  }
  return normalize(s);
}

// Re-release names that still count as "the game" for a soundtrack page.
const EDITION_SUFFIXES = [
  "complete edition",
  "game of the year edition",
  "goty edition",
  "goty",
  "definitive edition",
  "enhanced edition",
  "standard edition",
  "remastered",
  "remaster",
  "directors cut",
  "anniversary edition",
];

const PLATFORM_RANK = ["steam", "gog", "gog com", "epic games launcher", "ea app", "ubisoft connect"];

function titleScore(product: CatalogProduct, game: string): number {
  const base = baseTitle(product.name);
  if (base === game) return 10;
  for (const ed of EDITION_SUFFIXES) {
    if (base === `${game} ${ed}`) return 6;
  }
  return 0;
}

// Tie-breaks between products that match the title equally well: base game
// over DLC, in stock over pre-order, PC storefronts (Steam first) over
// console, then worldwide over regional (prices are USD, so NA is fine).
function preference(p: CatalogProduct): number {
  let score = 0;
  if (/games$/i.test(p.category)) score += 16;
  if (p.stock === "InStock") score += 8;
  const rank = PLATFORM_RANK.indexOf(normalize(p.platform));
  if (rank >= 0) score += 4 + (PLATFORM_RANK.length - rank) / PLATFORM_RANK.length;
  if (/worldwide/i.test(p.region)) score += 2;
  return score;
}

function findMatch(gameTitle: string, products: CatalogProduct[]): CatalogProduct | null {
  const game = normalize(gameTitle);
  if (!game) return null;
  let best: { p: CatalogProduct; score: number } | null = null;
  for (const p of products) {
    const t = titleScore(p, game);
    if (!t) continue;
    const score = t * 100 + preference(p) - p.price / 1000; // cheapest last
    if (!best || score > best.score) best = { p, score };
  }
  return best?.p ?? null;
}

// ── Supabase ──────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  game_title: string;
  loaded_url: string | null;
}

// PostgREST caps responses at 1000 rows — page through.
async function loadSoundtracks(): Promise<Row[]> {
  const rows: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("soundtracks")
      .select("id, game_title, loaded_url")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to read soundtracks: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

interface PricePatch {
  loaded_url?: string;
  loaded_price: number | null;
  loaded_original_price: number | null;
  loaded_currency: string | null;
  loaded_price_updated_at: string | null;
}

function pricePatch(p: CatalogProduct | null, now: string): PricePatch {
  if (!p) {
    return {
      loaded_price: null,
      loaded_original_price: null,
      loaded_currency: null,
      loaded_price_updated_at: null,
    };
  }
  return {
    loaded_price: p.price,
    loaded_original_price:
      p.originalPrice !== null && p.originalPrice > p.price ? p.originalPrice : null,
    loaded_currency: p.currency,
    loaded_price_updated_at: now,
  };
}

async function applyUpdates(updates: { id: string; patch: PricePatch }[]) {
  let failed = 0;
  const CONCURRENCY = 8;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    await Promise.all(
      updates.slice(i, i + CONCURRENCY).map(async ({ id, patch }) => {
        const { error } = await supabase.from("soundtracks").update(patch).eq("id", id);
        if (error) {
          failed++;
          console.log(`  FAILED ${id}: ${error.message}`);
        }
      }),
    );
  }
  return failed;
}

function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("SoundTrek — Loaded price sync");
  if (DRY_RUN) console.log("  Mode  : DRY RUN");
  if (MATCH) console.log("  Match : auto-linking unlinked soundtracks");
  console.log("");

  const products = await loadCatalog();
  console.log(`Catalog: ${products.length} ${CATALOG_CURRENCY} products`);

  const byPage = new Map<string, CatalogProduct>();
  for (const p of products) {
    const key = pageKey(p.pageUrl);
    if (key) byPage.set(key, p);
  }

  const rows = await loadSoundtracks();
  console.log(`Soundtracks: ${rows.length}\n`);

  const now = new Date().toISOString();
  const updates: { id: string; patch: PricePatch }[] = [];
  let priced = 0;
  let missing = 0;
  let matched = 0;

  for (const row of rows) {
    if (row.loaded_url) {
      const key = pageKey(row.loaded_url);
      const product = key ? byPage.get(key) ?? null : null;
      if (product) {
        priced++;
      } else {
        missing++;
        console.log(`  not in catalog: ${row.game_title} → ${row.loaded_url}`);
      }
      updates.push({ id: row.id, patch: pricePatch(product, now) });
    } else if (MATCH) {
      const product = findMatch(row.game_title, products);
      if (!product) continue;
      matched++;
      console.log(
        `  match: ${row.game_title}  ⇒  ${product.name} [${product.platform}, ${money(product.price, product.currency)}]  ${product.pageUrl}`,
      );
      updates.push({
        id: row.id,
        patch: { loaded_url: product.pageUrl, ...pricePatch(product, now) },
      });
    }
  }

  const failed = DRY_RUN ? 0 : await applyUpdates(updates);

  console.log(`
────────────────────────────────
Priced         : ${priced}
Not in catalog : ${missing}${MATCH ? `\nNewly matched  : ${matched}` : ""}
Failed         : ${failed}${DRY_RUN ? "\n(dry run — nothing written)" : ""}
────────────────────────────────`);

  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
