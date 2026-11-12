import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync } from "fs";

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
);

const BASE = "https://soundtrek.app";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function url(loc: string, lastmod?: string): string {
  return lastmod
    ? `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`
    : `  <url><loc>${loc}</loc></url>`;
}

async function main() {
  // PostgREST caps a select at 1000 rows, so page through the table —
  // otherwise the sitemap silently stops at the first 1000 soundtracks.
  const soundtracks: {
    id: string;
    slug: string | null;
    composers: string[] | null;
    studio: string | null;
    genre_tags: string[] | null;
    theme_tags: string[] | null;
    console: string | null;
    created_at: string | null;
  }[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("soundtracks")
      .select(
        "id, slug, composers, studio, genre_tags, theme_tags, console, created_at",
      )
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    soundtracks.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const staticUrls = [
    url(`${BASE}/`),
    url(`${BASE}/about`),
    url(`${BASE}/discover`),
    url(`${BASE}/catalog`),
    url(`${BASE}/top`),
    url(`${BASE}/top-composers`),
    url(`${BASE}/studios`),
    url(`${BASE}/explore`),
  ];

  const soundtrackUrls = soundtracks.map((s) =>
    url(`${BASE}/soundtrack/${s.slug ?? s.id}`, s.created_at?.split("T")[0]),
  );

  // Listing pages (composer, studio, category), each dated by the newest
  // soundtrack on it, so crawlers revisit the ones that actually changed.
  // Paths must match the prerendered routes in vite.config.ts exactly —
  // anything else is served the homepage's HTML.
  const listingDates = new Map<string, string>();
  function addListing(path: string, createdAt: string | null) {
    const day = createdAt?.split("T")[0] ?? "";
    const prev = listingDates.get(path);
    if (prev === undefined || day > prev) listingDates.set(path, day);
  }
  for (const s of soundtracks) {
    for (const c of s.composers ?? []) addListing(`/composer/${toSlug(c)}`, s.created_at);
    if (s.studio) addListing(`/studio/${toSlug(s.studio)}`, s.created_at);
    for (const t of s.genre_tags ?? []) addListing(`/category/genre/${toSlug(t)}`, s.created_at);
    for (const t of s.theme_tags ?? []) addListing(`/category/theme/${toSlug(t)}`, s.created_at);
    if (s.console) addListing(`/category/console/${toSlug(s.console)}`, s.created_at);
  }
  const listingUrls = [...listingDates]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, day]) => url(`${BASE}${path}`, day || undefined));

  const allUrls = [...staticUrls, ...soundtrackUrls, ...listingUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.join("\n")}
</urlset>`;

  writeFileSync("public/sitemap.xml", xml);
  console.log(`✓ sitemap.xml — ${allUrls.length} URLs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
