// functions/_middleware.js

const ALLOWED = [
  /^\/$/,                       // home
  /^\/part\/[^/]+\/?$/i,        // /part/:mpn
  /^\/refurb\/[^/]+\/?$/i,      // /refurb/:mpn
  /^\/model\/[^/]+\/?$/i,       // /model/:modelNumber
  /^\/cart\/?$/i,
  /^\/checkout\/?$/i,
  /^\/success\/?$/i,
  /^\/order\/[^/]+\/?$/i,       // /order/:token
  /^\/search\/?$/i,
];

function isAssetPath(pathname) {
  if (pathname.startsWith("/assets/")) return true;
  return /\.(css|js|map|png|jpg|jpeg|webp|gif|svg|ico|txt|xml|json)$/i.test(
    pathname
  );
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // IMPORTANT: allow our internal fetch to bypass allowlist logic
  if (request.headers.get("x-mw-skip") === "1") {
    return next();
  }

  // Only intercept browser navigations
  if (request.method !== "GET" && request.method !== "HEAD") {
    return next();
  }

  // Never touch real static assets
  if (isAssetPath(pathname)) {
    return next();
  }

  // Let these always pass through
  if (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/favicon.ico"
  ) {
    return next();
  }

  // Allowed app routes: serve normally
  if (ALLOWED.some((re) => re.test(pathname))) {
    return next();
  }

  // Everything else is "junk": return your SPA shell (index.html) BUT with HTTP 404
  // so the app can render your React NotFound page while the HTTP status is correct.
  const indexUrl = new URL("/index.html", url.origin);
  const headers = new Headers(request.headers);
  headers.set("x-mw-skip", "1"); // prevent recursion
  headers.set("accept", "text/html"); // ensure HTML

  const indexReq = new Request(indexUrl.toString(), {
    method: "GET",
    headers,
  });

  const res = await fetch(indexReq);

  // Return same HTML body, but force status 404
  return new Response(res.body, {
    status: 404,
    headers: res.headers,
  });
}
