// src/seo/seoConfig.js

export const SEO_CONFIG = {
  siteName: "Appliance Part Geeks",

  // Preferred canonical host (Cloudflare redirects apex -> www)
  canonicalOrigin: "https://www.appliancepartgeeks.com",

  // Global default meta description
  tagline:
    "The only store offering both new and refurbished appliance parts—If we don't have the part, it no longer exists anywhere.",

  // Hard cap recommended for meta descriptions (Google often truncates beyond ~160)
  descriptionMaxLen: 160,

  // Defaults
  defaultRobots: "index,follow",
  privateRobots: "noindex,nofollow",

  // Optional: default social image if you later add OG/Twitter cards
  // defaultOgImage: "https://.../og-default.png",
};

/**
 * Build a canonical URL from a pathname (optionally including a query string).
 * - Ensures a leading slash
 * - Avoids double slashes when pathname is "/"
 * - Preserves query string if included in pathname
 */
export function buildCanonical(pathname = "/") {
  const raw = (pathname || "/").toString().trim();

  // Allow passing "/model?x=y" or "model?x=y"
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;

  // Avoid https://www...// when pathname is "/"
  const normalizedPath =
    withLeadingSlash === "/" ? "" : withLeadingSlash.replace(/^\/+/, "/");

  return `${SEO_CONFIG.canonicalOrigin}${normalizedPath || "/"}`;
}

export function clampDescription(s) {
  const text = (s || "").toString().trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= SEO_CONFIG.descriptionMaxLen) return text;
  return text.slice(0, SEO_CONFIG.descriptionMaxLen - 1).trimEnd() + "…";
}
