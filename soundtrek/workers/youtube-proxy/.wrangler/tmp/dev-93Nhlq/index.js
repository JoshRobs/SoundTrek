var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    if (url.pathname === "/catalog") {
      return catalog(env);
    }
    if (url.pathname === "/igdb-search") {
      const q = url.searchParams.get("q") ?? "";
      return igdbSearch(q, env);
    }
    if (url.pathname === "/igdb-random-indie") {
      return igdbRandomIndie(env);
    }
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
          "Cache-Control": "public, max-age=86400"
        }
      });
    }
    const items = [];
    let pageToken;
    do {
      const pageUrl = new URL(
        "https://www.googleapis.com/youtube/v3/playlistItems"
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
          headers: CORS_HEADERS
        });
      }
      const data = await ytRes.json();
      for (const item of data.items ?? []) {
        const title = item.snippet.title;
        const unavailable = title === "Deleted video" || title === "Private video";
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
        "Cache-Control": "public, max-age=86400"
      }
    });
  }
};
var CATALOG_TTL = 3600;
var CATALOG_BROWSER_TTL = 900;
async function catalog(env) {
  const cacheKey = "catalog:v1";
  const cached = await env.YOUTUBE_CACHE.get(cacheKey);
  if (cached) return catalogResponse(cached);
  const PAGE = 1e3;
  const rows = [];
  let from = 0;
  while (true) {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/soundtracks?select=*&order=created_at.asc`,
      {
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          Range: `${from}-${from + PAGE - 1}`
        }
      }
    );
    if (!res.ok) {
      return new Response("Upstream error", {
        status: res.status,
        headers: CORS_HEADERS
      });
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  const body = JSON.stringify(rows);
  await env.YOUTUBE_CACHE.put(cacheKey, body, { expirationTtl: CATALOG_TTL });
  return catalogResponse(body);
}
__name(catalog, "catalog");
function catalogResponse(body) {
  return new Response(body, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CATALOG_BROWSER_TTL}`
    }
  });
}
__name(catalogResponse, "catalogResponse");
async function playlistInfo(playlistId, env) {
  const cacheKey = `playlist-info:${playlistId}`;
  const cached = await env.YOUTUBE_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
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
      headers: CORS_HEADERS
    });
  }
  const data = await ytRes.json();
  const item = data.items?.[0];
  if (!item) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  const body = JSON.stringify({
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    itemCount: item.contentDetails?.itemCount
  });
  await env.YOUTUBE_CACHE.put(cacheKey, body, { expirationTtl: 3600 });
  return new Response(body, {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}
__name(playlistInfo, "playlistInfo");
async function videoInfo(videoId, env) {
  const cacheKey = `video-info:${videoId}`;
  const cached = await env.YOUTUBE_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
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
      headers: CORS_HEADERS
    });
  }
  const data = await ytRes.json();
  const item = data.items?.[0];
  if (!item) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  const body = JSON.stringify({
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    duration: item.contentDetails?.duration
  });
  await env.YOUTUBE_CACHE.put(cacheKey, body, { expirationTtl: 3600 });
  return new Response(body, {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}
__name(videoInfo, "videoInfo");
function computePopularity(rating, ratingCount) {
  if (!rating || !ratingCount) return null;
  const C = 70;
  const m = 500;
  return ratingCount / (ratingCount + m) * rating + m / (ratingCount + m) * C;
}
__name(computePopularity, "computePopularity");
function parseCoverUrl(coverUrl) {
  return `https:${coverUrl.replace("t_thumb", "t_cover_big")}`;
}
__name(parseCoverUrl, "parseCoverUrl");
function parseCoverUrlHd(coverUrl) {
  return `https:${coverUrl.replace("t_thumb", "t_cover_big_2x")}`;
}
__name(parseCoverUrlHd, "parseCoverUrlHd");
function parseDeveloper(game) {
  const dev = game.involved_companies?.find((c) => c.developer);
  const pub = game.involved_companies?.find((c) => c.publisher);
  return dev?.company.name ?? pub?.company.name ?? "Unknown";
}
__name(parseDeveloper, "parseDeveloper");
function parsePlatform(game) {
  const platforms = game.platforms?.map((p) => p.name) ?? [];
  const console_ = platforms.find(
    (p) => !["PC", "Mac", "Linux", "Android", "iOS"].includes(p)
  );
  return console_ ?? platforms[0] ?? "Unknown";
}
__name(parsePlatform, "parsePlatform");
function parseReleaseYear(game) {
  if (!game.first_release_date) return 0;
  return new Date(game.first_release_date * 1e3).getFullYear();
}
__name(parseReleaseYear, "parseReleaseYear");
async function getIGDBToken(env) {
  const cached = await env.YOUTUBE_CACHE.get("igdb-token");
  if (cached) return cached;
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${env.TWITCH_CLIENT_ID}&client_secret=${env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get IGDB token");
  const ttl = Math.max((data.expires_in ?? 3600) - 3600, 300);
  await env.YOUTUBE_CACHE.put("igdb-token", data.access_token, {
    expirationTtl: ttl
  });
  return data.access_token;
}
__name(getIGDBToken, "getIGDBToken");
var IGDB_FIELDS = `fields name, rating, rating_count, first_release_date, cover.url,
         platforms.name, genres.name, genres.id,
         involved_companies.company.name,
         involved_companies.developer,
         involved_companies.publisher;`;
function mapIgdbGame(game) {
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
    popularity: computePopularity(game.rating, game.rating_count)
  };
}
__name(mapIgdbGame, "mapIgdbGame");
async function igdbSearch(query, env) {
  const q = query.trim();
  if (!q) {
    return new Response(JSON.stringify({ error: "missing query" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "IGDB credentials not configured on worker" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
  const cacheKey = `igdb-search:v2:${q.toLowerCase()}`;
  const cached = await env.YOUTUBE_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  let token;
  try {
    token = await getIGDBToken(env);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
  const escaped = q.replace(/["\\]/g, "\\$&");
  async function runQuery(body) {
    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": env.TWITCH_CLIENT_ID,
        "Content-Type": "text/plain"
      },
      body
    });
    if (!r.ok) return { error: `IGDB request failed: ${r.status}` };
    return await r.json();
  }
  __name(runQuery, "runQuery");
  let games = await runQuery(`
    search "${escaped}";
    ${IGDB_FIELDS}
    where version_parent = null;
    limit 12;
  `.trim());
  if (!Array.isArray(games)) {
    return new Response(JSON.stringify({ error: games.error }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  if (games.length === 0) {
    const fallback = await runQuery(`
      ${IGDB_FIELDS}
      where name ~ *"${escaped}"* & version_parent = null;
      sort rating_count desc;
      limit 20;
    `.trim());
    if (Array.isArray(fallback)) {
      const ql = q.toLowerCase();
      const tier = /* @__PURE__ */ __name((g) => {
        const n = g.name.toLowerCase();
        if (n === ql) return 0;
        if (n.startsWith(ql)) return 1;
        return 2;
      }, "tier");
      games = fallback.sort((a, b) => tier(a) - tier(b) || (b.rating_count ?? 0) - (a.rating_count ?? 0)).slice(0, 12);
    }
  }
  const results = games.map(mapIgdbGame);
  const out = JSON.stringify({ results });
  await env.YOUTUBE_CACHE.put(cacheKey, out, { expirationTtl: 3600 });
  return new Response(out, {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}
__name(igdbSearch, "igdbSearch");
async function igdbRandomIndie(env) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "IGDB credentials not configured on worker" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
  let token;
  try {
    token = await getIGDBToken(env);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  const INDIE_GENRE = 32;
  const MIN_RATING_COUNT = 5;
  const now = Math.floor(Date.now() / 1e3);
  const windowStart = now - 5 * 365 * 24 * 3600;
  const where = `genres = (${INDIE_GENRE}) & cover != null & version_parent = null & first_release_date != null & first_release_date < ${now} & first_release_date > ${windowStart} & rating_count >= ${MIN_RATING_COUNT}`;
  async function igdb(endpoint, body) {
    const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": env.TWITCH_CLIENT_ID,
        "Content-Type": "text/plain"
      },
      body
    });
    if (!r.ok) return { error: `IGDB request failed: ${r.status}` };
    return await r.json();
  }
  __name(igdb, "igdb");
  const LIMIT = 20;
  const countRes = await igdb("games/count", `where ${where};`);
  if (!("count" in countRes)) {
    return new Response(JSON.stringify({ error: countRes.error }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  const total = countRes.count;
  const maxOffset = Math.max(0, total - LIMIT);
  const offset = Math.floor(Math.random() * (maxOffset + 1));
  const games = await igdb(
    "games",
    `${IGDB_FIELDS} where ${where}; sort first_release_date desc; limit ${LIMIT}; offset ${offset};`
  );
  if (!Array.isArray(games)) {
    return new Response(JSON.stringify({ error: games.error }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  for (let i = games.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [games[i], games[j]] = [games[j], games[i]];
  }
  const out = JSON.stringify({ results: games.map(mapIgdbGame) });
  return new Response(out, {
    // No cache — each click should surface a fresh random game.
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
__name(igdbRandomIndie, "igdbRandomIndie");
async function fetchFirstPlaylistVideo(playlistId, env) {
  const params = new URLSearchParams({
    part: "contentDetails",
    playlistId,
    maxResults: "1",
    key: env.YOUTUBE_API_KEY
  });
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?${params}`
  );
  const data = await res.json();
  return data.items?.[0]?.contentDetails?.videoId ?? null;
}
__name(fetchFirstPlaylistVideo, "fetchFirstPlaylistVideo");
var MIN_DURATION = 15 * 60;
var MIN_SCORE = 4;
var BAD_KEYWORDS = [
  "cover",
  "covers",
  "remix",
  "remixed",
  "piano",
  "tribute",
  "arrangement",
  "arranged",
  "karaoke",
  "lofi",
  "lo-fi",
  "chiptune",
  "jazz",
  "8-bit",
  "8bit",
  "fan made",
  "fan-made",
  "loop",
  "walkthrough",
  "1 hour",
  "one hour",
  "extended",
  "menu theme",
  "lobby theme",
  "title screen"
];
var OST_KEYWORDS = [
  "original soundtrack",
  "original game soundtrack",
  "original score",
  "full ost",
  "complete ost",
  "full soundtrack",
  "complete soundtrack",
  "game music",
  "music from",
  " ost "
];
var ROMAN_NUMERALS = /* @__PURE__ */ new Set([
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "xi",
  "xii",
  "xiii",
  "xiv",
  "xv",
  "xvi",
  "xvii",
  "xviii",
  "xix",
  "xx",
  "xxi",
  "xxii",
  "xxiii",
  "xxiv",
  "xxv",
  "xxvi",
  "xxvii",
  "xxviii",
  "xxix",
  "xxx"
]);
function normalizeTitle(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}
__name(normalizeTitle, "normalizeTitle");
function hasUnexpectedSeriesNumber(gt, vt) {
  const idx = vt.indexOf(gt);
  if (idx === -1) return false;
  const after = vt.slice(idx + gt.length).trimStart();
  const arabicMatch = after.match(/^(\d+)/);
  if (arabicMatch) {
    const gameNumbers = gt.match(/\d+/g) ?? [];
    if (!gameNumbers.includes(arabicMatch[1])) return true;
  }
  const romanMatch = after.match(/^([a-z]+)/);
  if (romanMatch && ROMAN_NUMERALS.has(romanMatch[1])) {
    const gameRomans = gt.split(" ").filter((w) => ROMAN_NUMERALS.has(w));
    if (!gameRomans.includes(romanMatch[1])) return true;
  }
  return false;
}
__name(hasUnexpectedSeriesNumber, "hasUnexpectedSeriesNumber");
function scoreVideo(videoTitle, gameTitle, durationSeconds) {
  const vt = normalizeTitle(videoTitle);
  const gt = normalizeTitle(gameTitle);
  if (durationSeconds < MIN_DURATION) return -1;
  if (Math.abs(durationSeconds - 3600) <= 2) return -1;
  if (BAD_KEYWORDS.some((b) => vt.includes(b))) return -1;
  let score = 0;
  if (vt === gt) score += 5;
  else if (vt.includes(gt)) score += 4;
  else return -1;
  if (hasUnexpectedSeriesNumber(gt, vt)) return -1;
  if (!vt.includes("soundtrack") && !vt.includes(" ost") && !vt.includes("(ost)") && !vt.includes("[ost]")) return -1;
  if (OST_KEYWORDS.some((k) => vt.includes(k))) score += 3;
  else score += 1;
  if (durationSeconds >= 60 * 60) score += 1;
  return score;
}
__name(scoreVideo, "scoreVideo");
function parseISO8601Seconds(iso) {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return parseInt(m[1] ?? "0", 10) * 3600 + parseInt(m[2] ?? "0", 10) * 60 + parseInt(m[3] ?? "0", 10);
}
__name(parseISO8601Seconds, "parseISO8601Seconds");
async function fetchVideoDurations(videoIds, env) {
  const out = /* @__PURE__ */ new Map();
  if (!videoIds.length) return out;
  const params = new URLSearchParams({
    part: "contentDetails",
    id: videoIds.join(","),
    key: env.YOUTUBE_API_KEY
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!res.ok) return out;
  const data = await res.json();
  for (const item of data.items ?? []) {
    out.set(item.id, parseISO8601Seconds(item.contentDetails?.duration ?? ""));
  }
  return out;
}
__name(fetchVideoDurations, "fetchVideoDurations");
async function youtubeSearch(query, env) {
  const q = query.trim();
  if (!q) {
    return new Response(JSON.stringify({ error: "missing query" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  const cacheKey = `youtube-search:v2:${q.toLowerCase()}`;
  const cached = await env.YOUTUBE_CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
  const params = new URLSearchParams({
    part: "snippet",
    q: `${q} full OST complete soundtrack`,
    maxResults: "5",
    relevanceLanguage: "en",
    key: env.YOUTUBE_API_KEY
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  const data = await res.json();
  if (data.error) {
    return new Response(
      JSON.stringify({ error: data.error.message, code: data.error.code }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
  let result = null;
  const playlist = data.items?.find((i) => i.id.kind === "youtube#playlist");
  if (playlist?.id.playlistId) {
    const firstVideoId = await fetchFirstPlaylistVideo(playlist.id.playlistId, env);
    result = {
      youtube_playlist_id: playlist.id.playlistId,
      youtube_video_id: firstVideoId,
      source_type: "playlist"
    };
  } else {
    const candidates = (data.items ?? []).filter((i) => i.id.kind === "youtube#video" && i.id.videoId).map((i) => ({ videoId: i.id.videoId, title: i.snippet?.title ?? "" }));
    const durations = await fetchVideoDurations(candidates.map((c) => c.videoId), env);
    let best = null;
    for (const c of candidates) {
      const score = scoreVideo(c.title, q, durations.get(c.videoId) ?? 0);
      if (score < MIN_SCORE) continue;
      if (!best || score > best.score) best = { videoId: c.videoId, score };
    }
    if (best) {
      result = {
        youtube_video_id: best.videoId,
        youtube_playlist_id: null,
        source_type: "video"
      };
    }
  }
  const out = JSON.stringify({ result });
  await env.YOUTUBE_CACHE.put(cacheKey, out, { expirationTtl: 86400 });
  return new Response(out, {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}
__name(youtubeSearch, "youtubeSearch");

// ../../../../../Users/jdrjo/AppData/Roaming/fnm/node-versions/v23.11.0/installation/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../Users/jdrjo/AppData/Roaming/fnm/node-versions/v23.11.0/installation/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-spmbNT/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../../Users/jdrjo/AppData/Roaming/fnm/node-versions/v23.11.0/installation/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-spmbNT/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
