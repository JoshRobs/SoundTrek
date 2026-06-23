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
  const { data: soundtracks, error } = await supabase
    .from("soundtracks")
    .select("id, composers, created_at");

  if (error) throw error;

  const staticUrls = [
    url(`${BASE}/`),
    url(`${BASE}/discover`),
    url(`${BASE}/catalog`),
    url(`${BASE}/top`),
    url(`${BASE}/top-composers`),
    url(`${BASE}/explore`),
  ];

  const soundtrackUrls = (soundtracks ?? []).map((s) =>
    url(`${BASE}/soundtrack/${s.id}`, s.created_at?.split("T")[0]),
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
