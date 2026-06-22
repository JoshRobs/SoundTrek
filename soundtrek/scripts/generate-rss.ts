import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync } from "fs";

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
);

const BASE = "https://soundtrek.app";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const { data: soundtracks, error } = await supabase
    .from("soundtracks")
    .select(
      "id, game_title, composer, release_year, cover_image_url, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const items = (soundtracks ?? []).map((s) => {
    const link = `${BASE}/soundtrack/${s.id}`;
    const pubDate = new Date(s.created_at).toUTCString();
    const description = `${escape(s.game_title)} soundtrack by ${escape(s.composer)} (${s.release_year})`;
    const image = s.cover_image_url
      ? `<enclosure url="${escape(s.cover_image_url)}" type="image/jpeg" length="0" />`
      : "";
    return `  <item>
    <title>${escape(s.game_title)} OST</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <description>${description}</description>
    <pubDate>${pubDate}</pubDate>
    ${image}
  </item>`;
  });

  const buildDate = new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SoundTrek - New Soundtracks</title>
    <link>${BASE}</link>
    <description>The latest video game soundtracks added to SoundTrek.</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>`;

  writeFileSync("public/rss.xml", xml);
  console.log(`✓ rss.xml — ${items.length} items`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
