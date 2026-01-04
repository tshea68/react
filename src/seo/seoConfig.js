// src/seo/seoConfig.js

export const SEO_CONFIG = {
  siteName: "Appliance Part Geeks",
  // Your preferred canonical host (you are already forcing apex -> www via Cloudflare)
  canonicalOrigin: "https://www.appliancepartgeeks.com",

  // Your global tagline (use as default meta description)
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

export function buildCanonical(pathname = "/") {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SEO_CONFIG.canonicalOrigin}${p}`;
}

export function clampDescription(s) {
  const text = (s || "").toString().trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= SEO_CONFIG.descriptionMaxLen) return text;
  return text.slice(0, SEO_CONFIG.descriptionMaxLen - 1).trimEnd() + "…";
}

