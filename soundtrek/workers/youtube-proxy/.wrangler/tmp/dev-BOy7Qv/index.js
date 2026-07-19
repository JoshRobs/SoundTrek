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

// .wrangler/tmp/bundle-I5Fook/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-I5Fook/middleware-loader.entry.ts
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
