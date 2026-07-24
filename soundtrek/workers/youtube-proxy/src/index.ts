export interface Env {
  YOUTUBE_CACHE: KVNamespace;
  YOUTUBE_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  // IGDB (via Twitch OAuth) — used by the admin "Import from IGDB" flow, which
  // mirrors scripts/ingest.ts. Set with `wrangler secret put TWITCH_CLIENT_ID`
  // and `wrangler secret put TWITCH_CLIENT_SECRET`.
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/catalog") {
      return catalog(env);
    }

    // Admin "Import from IGDB" — search IGDB for games by name (mirrors the
    // metadata parsing in scripts/ingest.ts).
    if (url.pathname === "/igdb-search") {
      const q = url.searchParams.get("q") ?? "";
      return igdbSearch(q, env);
    }

    // Admin "Surprise me" — a random recent indie game to add.
    if (url.pathname === "/igdb-random-indie") {
      return igdbRandomIndie(env);
    }

    // Admin "Import from IGDB" — find a YouTube OST for a game title (mirrors
    // searchYouTube in scripts/ingest.ts).
    if (url.pathname === "/youtube-search") {
      const q = url.searchParams.get("q") ?? "";
      return youtubeSearch(q, env);
    }

    const infoMatch = url.pathname.match(/^\/playlist-info\/([A-Za-z0-9_-]+)$/);
    if (infoMatch) {
      return playlistInfo(infoMatch[1], env);
    }

    const videoInfoMatch = url.pathname.match(/^\/video-info\/([A-Za-z0-9_-]+)$/);
    if (videoInfoMatch) {
      return videoInfo(videoInfoMatch[1], env);
    }

    const match = url.pathname.match(/^\/playlist\/([A-Za-z0-9_-]+)$/);
    if (!match) {
      return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    }

    const playlistId = match[1];
    const cacheKey = `playlist:${playlistId}`;

    const cached = await env.YOUTUBE_CACHE.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const items: { videoId: string; title: string; unavailable: boolean }[] = [];
    let pageToken: string | undefined;

    do {
      const pageUrl = new URL(
        "https://www.googleapis.com/youtube/v3/playlistItems",
      );
      pageUrl.searchParams.set("part", "snippet");
      pageUrl.searchParams.set("playlistId", playlistId);
      pageUrl.searchParams.set("maxResults", "50");
      pageUrl.searchParams.set("key", env.YOUTUBE_API_KEY);
      if (pageToken) pageUrl.searchParams.set("pageToken", pageToken);

      const ytRes = await fetch(pageUrl.toString());
      if (!ytRes.ok) {
        return new Response("Upstream error", {
          status: ytRes.status,
          headers: CORS_HEADERS,
        });
      }

      const data = (await ytRes.json()) as {
        items?: any[];
        nextPageToken?: string;
      };

      for (const item of data.items ?? []) {
        const title = item.snippet.title as string;
        const unavailable =
          title === "Deleted video" || title === "Private video";
        items.push({ videoId: item.snippet.resourceId.videoId, title, unavailable });
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    const body = JSON.stringify(items);
    await env.YOUTUBE_CACHE.put(cacheKey, body, { expirationTtl: 86400 });

    return new Response(body, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400",
      },
    });
  },
};

// Full soundtracks catalog, cached in KV so Supabase egress is ~1 fetch per
// TTL instead of ~2MB per visitor. Public data only — no auth is forwarded,
// so nothing user-specific can ever end up in the shared cache. Admin pages
// bypass this entirely and read Supabase directly (see loadAll's fresh flag).
const CATALOG_TTL = 3600; // KV: at most one Supabase fetch per hour
const CATALOG_BROWSER_TTL = 900; // repeat visitors skip the worker too

async function catalog(env: Env): Promise<Response> {
  const cacheKey = "catalog:v1";

  const cached = await env.YOUTUBE_CACHE.get(cacheKey);
  if (cached) return catalogResponse(cached);

  // PostgREST caps responses at 1000 rows — page through like the client did.
  const PAGE = 1000;
  const rows: unknown[] = [];
  let from = 0;
  while (true) {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/soundtracks?select=*&order=created_at.asc`,
      {
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          Range: `${from}-${from + PAGE - 1}`,
        },
      },
    );
    if (!res.ok) {
      return new Response("Upstream error", {
        status: res.status,
        headers: CORS_HEADERS,
      });
    }
    const page = (await res.json()) as unknown[];
    rows.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }

  const body = JSON.stringify(rows);
  await env.YOUTUBE_CACHE.put(cacheKey, body, { expirationTtl: CATALOG_TTL });
  return catalogResponse(body);
}

function catalogResponse(body: string): Response {
  return new Response(body, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CATALOG_BROWSER_TTL}`,
    },
  });
}

// Playlist metadata (title, item count) — used by the admin link checker.
// Cached briefly so repeated checks are cheap but corrections show up fast.
async function playlistInfo(playlistId: string, env: Env): Promise<Response> {
  const cacheKey = `playlist-info:${playlistId}`;

  const cached = await env.YOUTUBE_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const apiUrl = new URL("https://www.googleapis.com/youtube/v3/playlists");
  apiUrl.searchParams.set("part", "snippet,contentDetails");
  apiUrl.searchParams.set("id", playlistId);
  apiUrl.searchParams.set("key", env.YOUTUBE_API_KEY);

  const ytRes = await fetch(apiUrl.toString());
  if (!ytRes.ok) {
    return new Response("Upstream error", {
      status: ytRes.status,
      headers: CORS_HEADERS,
    });
  }

  const data = (await ytRes.json()) as { items?: any[] };
  const item = data.items?.[0];
  if (!item) {
    // Valid response but no such playlist — deleted or private.
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const body = JSON.stringify({
    title: item.snippet.title as string,
    channel: item.snippet.channelTitle as string,
    itemCount: item.contentDetails?.itemCount as number | undefined,
  });
  await env.YOUTUBE_CACHE.put(cacheKey, body, { expirationTtl: 3600 });

  return new Response(body, {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Video metadata (title, channel, duration) — used by the admin link checker.
// oEmbed can't provide duration, so this goes through the Data API instead.
async function videoInfo(videoId: string, env: Env): Promise<Response> {
  const cacheKey = `video-info:${videoId}`;

  const cached = await env.YOUTUBE_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const apiUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  apiUrl.searchParams.set("part", "snippet,contentDetails");
  apiUrl.searchParams.set("id", videoId);
  apiUrl.searchParams.set("key", env.YOUTUBE_API_KEY);

  const ytRes = await fetch(apiUrl.toString());
  if (!ytRes.ok) {
    return new Response("Upstream error", {
      status: ytRes.status,
      headers: CORS_HEADERS,
    });
  }

  const data = (await ytRes.json()) as { items?: any[] };
  const item = data.items?.[0];
  if (!item) {
    // Valid response but no such video — deleted or private.
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const body = JSON.stringify({
    title: item.snippet.title as string,
    channel: item.snippet.channelTitle as string,
    duration: item.contentDetails?.duration as string | undefined,
  });
  await env.YOUTUBE_CACHE.put(cacheKey, body, { expirationTtl: 3600 });

  return new Response(body, {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── IGDB import (mirrors scripts/ingest.ts) ─────────────────────────────────
//
// The admin "Add Soundtrack" page uses these to auto-fill the form from IGDB +
// YouTube, exactly as the bulk ingest script does — just for one manually named
// game at a time. Parsing logic below is kept in lockstep with ingest.ts.

interface IGDBGame {
  id: number;
  name: string;
  rating?: number;
  rating_count?: number;
  first_release_date?: number;
  cover?: { url: string };
  platforms?: { name: string }[];
  genres?: { name: string; id: number }[];
  involved_companies?: {
    company: { name: string };
    developer: boolean;
    publisher: boolean;
  }[];
}

// Bayesian weighted rating: pulls low-vote games toward the mean (C=70, m=500).
function computePopularity(
  rating: number | undefined,
  ratingCount: number | undefined,
): number | null {
  if (!rating || !ratingCount) return null;
  const C = 70;
  const m = 500;
  return (ratingCount / (ratingCount + m)) * rating + (m / (ratingCount + m)) * C;
}

function parseCoverUrl(coverUrl: string): string {
  return `https:${coverUrl.replace("t_thumb", "t_cover_big")}`;
}

function parseCoverUrlHd(coverUrl: string): string {
  return `https:${coverUrl.replace("t_thumb", "t_cover_big_2x")}`;
}

function parseDeveloper(game: IGDBGame): string {
  const dev = game.involved_companies?.find((c) => c.developer);
  const pub = game.involved_companies?.find((c) => c.publisher);
  return dev?.company.name ?? pub?.company.name ?? "Unknown";
}

function parsePlatform(game: IGDBGame): string {
  const platforms = game.platforms?.map((p) => p.name) ?? [];
  const console_ = platforms.find(
    (p) => !["PC", "Mac", "Linux", "Android", "iOS"].includes(p),
  );
  return console_ ?? platforms[0] ?? "Unknown";
}

function parseReleaseYear(game: IGDBGame): number {
  if (!game.first_release_date) return 0;
  return new Date(game.first_release_date * 1000).getFullYear();
}

// Twitch app-access token, cached in KV. IGDB tokens live ~60 days; we cache
// for whatever expires_in reports, minus a buffer, so we mint one rarely.
async function getIGDBToken(env: Env): Promise<string> {
  const cached = await env.YOUTUBE_CACHE.get("igdb-token");
  if (cached) return cached;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${env.TWITCH_CLIENT_ID}&client_secret=${env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" },
  );
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error("Failed to get IGDB token");

  const ttl = Math.max((data.expires_in ?? 3600) - 3600, 300);
  await env.YOUTUBE_CACHE.put("igdb-token", data.access_token, {
    expirationTtl: ttl,
  });
  return data.access_token;
}

// Shared field selection + row mapping so /igdb-search and /igdb-random-indie
// return an identical candidate shape (mirrors scripts/ingest.ts).
const IGDB_FIELDS = `fields name, rating, rating_count, first_release_date, cover.url,
         platforms.name, genres.name, genres.id,
         involved_companies.company.name,
         involved_companies.developer,
         involved_companies.publisher;`;

function mapIgdbGame(game: IGDBGame) {
  return {
    igdb_id: game.id,
    game_title: game.name,
    studio: parseDeveloper(game),
    console: parsePlatform(game),
    release_year: parseReleaseYear(game),
    cover_image_url: game.cover ? parseCoverUrl(game.cover.url) : null,
    cover_image_url_hd: game.cover ? parseCoverUrlHd(game.cover.url) : null,
    genre_tags: game.genres?.map((g) => g.name.toLowerCase()) ?? [],
    rating: game.rating ?? null,
    rating_count: game.rating_count ?? null,
    popularity: computePopularity(game.rating, game.rating_count),
  };
}

async function igdbSearch(query: string, env: Env): Promise<Response> {
  const q = query.trim();
  if (!q) {
    return new Response(JSON.stringify({ error: "missing query" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "IGDB credentials not configured on worker" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Short KV cache so repeat searches don't hammer IGDB. Keyed on the raw query.
  // Version suffix (v2) busts entries cached before the stopword fallback.
  const cacheKey = `igdb-search:v2:${q.toLowerCase()}`;
  const cached = await env.YOUTUBE_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let token: string;
  try {
    token = await getIGDBToken(env);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const escaped = q.replace(/["\\]/g, "\\$&");

  async function runQuery(body: string): Promise<IGDBGame[] | { error: string }> {
    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": env.TWITCH_CLIENT_ID,
        "Content-Type": "text/plain",
      },
      body,
    });
    if (!r.ok) return { error: `IGDB request failed: ${r.status}` };
    return (await r.json()) as IGDBGame[];
  }

  // Primary: `search` ranks by relevance (no `sort` allowed alongside it).
  // version_parent = null drops editions/ports so we surface the base game.
  let games = await runQuery(`
    search "${escaped}";
    ${IGDB_FIELDS}
    where version_parent = null;
    limit 12;
  `.trim());

  if (!Array.isArray(games)) {
    return new Response(JSON.stringify({ error: games.error }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // IGDB's full-text `search` silently strips common stopwords, so single-word
  // titles that ARE stopwords ("Below", "Inside", "Control", "Journey", "Limbo")
  // return nothing. Fall back to a substring match (not stopword-filtered),
  // pulling the most-rated matches, then float exact/prefix name matches to top.
  if (games.length === 0) {
    const fallback = await runQuery(`
      ${IGDB_FIELDS}
      where name ~ *"${escaped}"* & version_parent = null;
      sort rating_count desc;
      limit 20;
    `.trim());
    if (Array.isArray(fallback)) {
      const ql = q.toLowerCase();
      const tier = (g: IGDBGame) => {
        const n = g.name.toLowerCase();
        if (n === ql) return 0;
        if (n.startsWith(ql)) return 1;
        return 2;
      };
      games = fallback
        .sort((a, b) => tier(a) - tier(b) || (b.rating_count ?? 0) - (a.rating_count ?? 0))
        .slice(0, 12);
    }
  }

  const results = games.map(mapIgdbGame);

  const out = JSON.stringify({ results });
  await env.YOUTUBE_CACHE.put(cacheKey, out, { expirationTtl: 3600 });

  return new Response(out, {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// A random recent indie game (genre 32) that plausibly has an OST — filtered to
// ones with a cover and some ratings, released in the last few years. Randomness
// comes from a random offset into the matching set; never cached so each call
// returns something different. The frontend skips any already in our catalog.
async function igdbRandomIndie(env: Env): Promise<Response> {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "IGDB credentials not configured on worker" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let token: string;
  try {
    token = await getIGDBToken(env);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const INDIE_GENRE = 32;
  const MIN_RATING_COUNT = 5;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 5 * 365 * 24 * 3600; // last ~5 years = "new"
  const where =
    `genres = (${INDIE_GENRE}) & cover != null & version_parent = null` +
    ` & first_release_date != null & first_release_date < ${now}` +
    ` & first_release_date > ${windowStart} & rating_count >= ${MIN_RATING_COUNT}`;

  async function igdb<T>(endpoint: string, body: string): Promise<T | { error: string }> {
    const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": env.TWITCH_CLIENT_ID,
        "Content-Type": "text/plain",
      },
      body,
    });
    if (!r.ok) return { error: `IGDB request failed: ${r.status}` };
    return (await r.json()) as T;
  }

  const LIMIT = 20;

  // How many games match, so we can land on a random window within the set.
  const countRes = await igdb<{ count: number }>("games/count", `where ${where};`);
  if (!("count" in countRes)) {
    return new Response(JSON.stringify({ error: countRes.error }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  const total = countRes.count;
  const maxOffset = Math.max(0, total - LIMIT);
  const offset = Math.floor(Math.random() * (maxOffset + 1));

  const games = await igdb<IGDBGame[]>(
    "games",
    `${IGDB_FIELDS} where ${where}; sort first_release_date desc; limit ${LIMIT}; offset ${offset};`,
  );
  if (!Array.isArray(games)) {
    return new Response(JSON.stringify({ error: games.error }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Shuffle so the frontend's "first not already in catalog" isn't biased toward
  // the newest in the window.
  for (let i = games.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [games[i], games[j]] = [games[j], games[i]];
  }

  const out = JSON.stringify({ results: games.map(mapIgdbGame) });
  return new Response(out, {
    // No cache — each click should surface a fresh random game.
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function fetchFirstPlaylistVideo(
  playlistId: string,
  env: Env,
): Promise<string | null> {
  const params = new URLSearchParams({
    part: "contentDetails",
    playlistId,
    maxResults: "1",
    key: env.YOUTUBE_API_KEY,
  });
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
  );
  const data = (await res.json()) as {
    items?: { contentDetails: { videoId: string } }[];
  };
  return data.items?.[0]?.contentDetails?.videoId ?? null;
}

// ── Single-video scoring (ported from scripts/enrich-video-ids.ts) ──────────
//
// When no playlist is found we fall back to a standalone video for the OST.
// A short clip (menu theme, a single track, a cover) is worthless as "the"
// soundtrack, so candidates are scored and must clear MIN_DURATION + MIN_SCORE
// exactly as the enrichment script does — just with a 15-minute floor.

const MIN_DURATION = 15 * 60; // 15 minutes, in seconds
const MIN_SCORE = 4;

const BAD_KEYWORDS = [
  "cover", "covers", "remix", "remixed", "piano", "tribute",
  "arrangement", "arranged", "karaoke", "lofi", "lo-fi",
  "chiptune", "jazz", "8-bit", "8bit", "fan made", "fan-made",
  "loop", "walkthrough", "1 hour", "one hour", "extended",
  "menu theme", "lobby theme", "title screen",
];

const OST_KEYWORDS = [
  "original soundtrack", "original game soundtrack", "original score",
  "full ost", "complete ost", "full soundtrack", "complete soundtrack",
  "game music", "music from", " ost ",
];

// Roman numerals I–XXX — covers any realistic game series
const ROMAN_NUMERALS = new Set([
  "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
  "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx",
  "xxi", "xxii", "xxiii", "xxiv", "xxv", "xxvi", "xxvii", "xxviii", "xxix", "xxx",
]);

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// True if the video title contains the game title followed immediately by a
// series number (Arabic or Roman) that isn't already part of the game title —
// e.g. game "Forza Horizon" vs video "Forza Horizon 6 OST" → reject.
function hasUnexpectedSeriesNumber(gt: string, vt: string): boolean {
  const idx = vt.indexOf(gt);
  if (idx === -1) return false;
  const after = vt.slice(idx + gt.length).trimStart();

  const arabicMatch = after.match(/^(\d+)/);
  if (arabicMatch) {
    const gameNumbers: string[] = gt.match(/\d+/g) ?? [];
    if (!gameNumbers.includes(arabicMatch[1])) return true;
  }

  const romanMatch = after.match(/^([a-z]+)/);
  if (romanMatch && ROMAN_NUMERALS.has(romanMatch[1])) {
    const gameRomans = gt.split(" ").filter((w) => ROMAN_NUMERALS.has(w));
    if (!gameRomans.includes(romanMatch[1])) return true;
  }

  return false;
}

function scoreVideo(videoTitle: string, gameTitle: string, durationSeconds: number): number {
  const vt = normalizeTitle(videoTitle);
  const gt = normalizeTitle(gameTitle);

  // Hard reject: too short, fake "exactly 1 hour" videos, or bad keywords
  if (durationSeconds < MIN_DURATION) return -1;
  if (Math.abs(durationSeconds - 3600) <= 2) return -1;
  if (BAD_KEYWORDS.some((b) => vt.includes(b))) return -1;

  let score = 0;

  // Game title must appear verbatim in the video title — hard reject otherwise
  if (vt === gt) score += 5;
  else if (vt.includes(gt)) score += 4;
  else return -1;

  if (hasUnexpectedSeriesNumber(gt, vt)) return -1;

  // Must contain "soundtrack" or "ost" — hard reject otherwise
  if (!vt.includes("soundtrack") && !vt.includes(" ost") && !vt.includes("(ost)") && !vt.includes("[ost]")) return -1;

  if (OST_KEYWORDS.some((k) => vt.includes(k))) score += 3;
  else score += 1;

  if (durationSeconds >= 60 * 60) score += 1;

  return score;
}

// ISO 8601 duration ("PT1H2M3S") → seconds. Returns 0 on anything unparseable.
function parseISO8601Seconds(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return parseInt(m[1] ?? "0", 10) * 3600 + parseInt(m[2] ?? "0", 10) * 60 + parseInt(m[3] ?? "0", 10);
}

// Durations for a set of video IDs via the Data API (1 unit, batched).
async function fetchVideoDurations(
  videoIds: string[],
  env: Env,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!videoIds.length) return out;
  const params = new URLSearchParams({
    part: "contentDetails",
    id: videoIds.join(","),
    key: env.YOUTUBE_API_KEY,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!res.ok) return out;
  const data = (await res.json()) as {
    items?: { id: string; contentDetails?: { duration?: string } }[];
  };
  for (const item of data.items ?? []) {
    out.set(item.id, parseISO8601Seconds(item.contentDetails?.duration ?? ""));
  }
  return out;
}

async function youtubeSearch(query: string, env: Env): Promise<Response> {
  const q = query.trim();
  if (!q) {
    return new Response(JSON.stringify({ error: "missing query" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Cache by game title — a search costs 100 Data API units, so repeats should
  // never re-spend quota. Version suffix (v2) busts pre-duration-filter entries.
  const cacheKey = `youtube-search:v2:${q.toLowerCase()}`;
  const cached = await env.YOUTUBE_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: `${q} full OST complete soundtrack`,
    maxResults: "5",
    relevanceLanguage: "en",
    key: env.YOUTUBE_API_KEY,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  const data = (await res.json()) as {
    items?: {
      id: { kind: string; videoId?: string; playlistId?: string };
      snippet?: { title?: string };
    }[];
    error?: { message: string; code: number };
  };

  if (data.error) {
    return new Response(
      JSON.stringify({ error: data.error.message, code: data.error.code }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let result: {
    youtube_video_id: string | null;
    youtube_playlist_id: string | null;
    source_type: "video" | "playlist";
  } | null = null;

  // Prefer a playlist — also grab its first video so the embed has a start point.
  const playlist = data.items?.find((i) => i.id.kind === "youtube#playlist");
  if (playlist?.id.playlistId) {
    const firstVideoId = await fetchFirstPlaylistVideo(playlist.id.playlistId, env);
    result = {
      youtube_playlist_id: playlist.id.playlistId,
      youtube_video_id: firstVideoId,
      source_type: "playlist",
    };
  } else {
    // No playlist — fall back to a standalone video, but only a long-form full
    // OST. Fetch durations for the video candidates and score them the same way
    // enrich-video-ids.ts does; anything under 15 min (or off-topic) is dropped.
    const candidates = (data.items ?? [])
      .filter((i) => i.id.kind === "youtube#video" && i.id.videoId)
      .map((i) => ({ videoId: i.id.videoId as string, title: i.snippet?.title ?? "" }));

    const durations = await fetchVideoDurations(candidates.map((c) => c.videoId), env);

    let best: { videoId: string; score: number } | null = null;
    for (const c of candidates) {
      const score = scoreVideo(c.title, q, durations.get(c.videoId) ?? 0);
      if (score < MIN_SCORE) continue;
      if (!best || score > best.score) best = { videoId: c.videoId, score };
    }

    if (best) {
      result = {
        youtube_video_id: best.videoId,
        youtube_playlist_id: null,
        source_type: "video",
      };
    }
  }

  const out = JSON.stringify({ result });
  await env.YOUTUBE_CACHE.put(cacheKey, out, { expirationTtl: 86400 });

  return new Response(out, {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
