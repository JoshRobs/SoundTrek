export interface Env {
  YOUTUBE_CACHE: KVNamespace;
  YOUTUBE_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
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
