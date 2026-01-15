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

  if (!isAllowed) {
    return new Response("<h1>404 — Page not found</h1>", {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-apg-pagesfn": "404-gate",
      },
    });
  }

  return next();
}
