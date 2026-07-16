import { mkdir, writeFile } from "node:fs/promises";

const worker = `const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

const assetRequest = (request, pathname) => {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const wantsHtml = request.headers.get("accept")?.includes("text/html");
    if (!wantsHtml || url.pathname.includes(".")) return response;

    const indexResponse = await env.ASSETS.fetch(assetRequest(request, "/index.html"));
    const headers = new Headers(indexResponse.headers);
    headers.set("content-type", contentTypes[".html"]);
    return new Response(indexResponse.body, {
      status: indexResponse.status,
      statusText: indexResponse.statusText,
      headers
    });
  }
};
`;

await mkdir("dist/server", { recursive: true });
await writeFile("dist/server/index.js", worker);
