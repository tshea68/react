export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Allow SEO/system endpoints
  if (path === "/robots.txt" || path.startsWith("/sitemap")) {
    return next();
  }

  // Allow static assets (Vite bundles, images, etc.)
  if (/\.[a-zA-Z0-9]{2,5}$/.test(path)) {
    return next();
  }

  // Allow SPA routes (do NOT use "/" as a prefix match)
  const ALLOW_PREFIXES = [
    "/grid",
    "/order",
    "/parts",
    "/refurb",
    "/model",
    "/cart",
    "/checkout",
    "/success",
    "/404",
  ];

  const isAllowed =
    path === "/" ||
    ALLOW_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

  // Block junk URLs: return the SPA /404 page content, but with real HTTP 404
  if (!isAllowed) {
    const notFoundUrl = new URL(request.url);
    notFoundUrl.pathname = "/404";

    // prevent conditional caching from turning this into 304
    const headersIn = new Headers(request.headers);
    headersIn.delete("if-none-match");
    headersIn.delete("if-modified-since");
    headersIn.delete("if-match");
    headersIn.delete("if-unmodified-since");

    const resp = await fetch(
      new Request(notFoundUrl.toString(), {
        method: request.method,
        headers: headersIn,
      })
    );

    const headersOut = new Headers(resp.headers);
    headersOut.delete("etag");
    headersOut.delete("last-modified");
    headersOut.set("cache-control", "no-store");
    headersOut.set("x-apg-pagesfn", "404-gate");

    return new Response(resp.body, { status: 404, headers: headersOut });
  }

  return next();
}
