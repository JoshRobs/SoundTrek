export interface Env {
  YOUTUBE_CACHE: KVNamespace;
  YOUTUBE_API_KEY: string;
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
