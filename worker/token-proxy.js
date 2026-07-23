// Cloudflare Worker: CORS relay for GitHub's OAuth Device Flow.
//
// GitHub's device-flow endpoints don't send Access-Control-Allow-Origin, so a
// static site can't call them directly from the browser. This worker is a
// thin, secret-free passthrough — it forwards exactly two POST requests and
// adds CORS headers. Deploy it yourself (free Cloudflare Workers tier) and
// point the site's "token proxy URL" setting at it.
//
// Deploy: `npx wrangler deploy worker/token-proxy.js --name dag-demo-token-proxy`
// (requires a free Cloudflare account; `npx wrangler login` first)

const ALLOWED_PATHS = {
  "/device/code": "https://github.com/login/device/code",
  "/access_token": "https://github.com/login/oauth/access_token",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const target = ALLOWED_PATHS[url.pathname];
    if (!target || request.method !== "POST") {
      return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    }

    const body = await request.text();
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  },
};
