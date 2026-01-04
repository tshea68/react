// functions/_middleware.js

const ALLOWED = [
  /^\/$/,                       // home
  /^\/part\/[^/]+\/?$/,         // /part/:mpn
  /^\/refurb\/[^/]+\/?$/,       // /refurb/:mpn
  /^\/model\/[^/]+\/?$/,        // /model/:modelNumber
  /^\/cart\/?$/,
  /^\/checkout\/?$/,
  /^\/success\/?$/,
  /^\/order\/[^/]+\/?$/,        // /order/:token
  /^\/search\/?$/,              // /search
];

function isAssetPath(pathname) {
  if (pathname.startsWith("/assets/")) return true;
  // common static files
  if (/\.(css|js|map|png|jpg|jpeg|webp|svg|ico|txt|xml|json)$/i.test(pathname)) return true;
  return false;
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only intercept browser navigations (GET/HEAD). Let API/posts/etc. pass through.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return next();
  }

  // Never touch real static assets
  if (isAssetPath(pathname)) {
    return next();
  }

  // Always serve the SPA shell for navigations
  // (this ensures React renders, even for unknown routes)
  const indexUrl = new URL("/index.html", url.origin);
  const indexResp = await fetch(indexUrl.toString(), request);

  const allowed = ALLOWED.some((re) => re.test(pathname));
  const status = allowed ? 200 : 404;

  // Return index.html but with correct status for junk URLs
  return new Response(indexResp.body, {
    status,
    headers: indexResp.headers,
  });
}
