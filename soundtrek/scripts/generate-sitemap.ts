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
    created_at: string | null;
  }[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("soundtracks")
      .select("id, slug, composers, created_at")
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
    url(`${BASE}/explore`),
  ];

  const soundtrackUrls = (soundtracks ?? []).map((s) =>
    url(`${BASE}/soundtrack/${s.slug ?? s.id}`, s.created_at?.split("T")[0]),
  );

  const composerSlugs = [
    ...new Set(
      (soundtracks ?? []).flatMap((s) => (s.composers ?? []).map(toSlug)),
    ),
  ];
  const composerUrls = composerSlugs.map((slug) =>
    url(`${BASE}/composer/${slug}`),
  );

  const allUrls = [...staticUrls, ...soundtrackUrls, ...composerUrls];

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
