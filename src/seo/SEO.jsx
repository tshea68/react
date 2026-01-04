// src/seo/SEO.jsx
import React from "react";
import { Helmet } from "react-helmet-async";
import { SEO_SLUGS } from "./seoSlugs";
import { SEO_CONFIG, clampDescription } from "./seoConfig";

/**
 * Single SEO renderer.
 *
 * Usage:
 *   <SEO slug="home" />
 *   <SEO slug="part" data={part} params={{ mpn }} />
 *
 * Notes:
 * - `pathname` should come from `useLocation().pathname` so canonical matches the URL.
 * - `params` should come from useParams() for /parts/:mpn etc.
 */
export default function SEO({ slug, pathname = "/", data = null, params = null }) {
  const builder = SEO_SLUGS?.[slug];

  // Safe fallback if someone passes an unknown slug
  const fallback = {
    title: `${SEO_CONFIG.siteName}`,
    description: clampDescription(SEO_CONFIG.tagline),
    canonical: SEO_CONFIG.canonicalOrigin + (pathname || "/"),
    robots: SEO_CONFIG.defaultRobots,
  };

  const meta =
    typeof builder === "function" ? builder({ pathname, data, params }) : fallback;

  const title = (meta?.title || fallback.title).toString();
  const description = clampDescription(meta?.description || fallback.description);
  const canonical = (meta?.canonical || fallback.canonical).toString();
  const robots = (meta?.robots || fallback.robots).toString();

  // Best-effort image picker for OG/Twitter (absolute URL)
  // Added: model exploded view fallback (first exploded view image)
  const rawImg =
    data?.image_url ||
    data?.imageUrl ||
    (Array.isArray(data?.images) ? data.images[0] : null) ||
    (Array.isArray(data?.exploded_views) ? data.exploded_views?.[0]?.image_url : null) ||
    data?.image ||
    data?.img ||
    null;

  let absImg = null;
  if (rawImg) {
    try {
      absImg = new URL(rawImg, SEO_CONFIG.canonicalOrigin).toString();
    } catch {
      absImg = null;
    }
  }

  const ogType = slug === "part" || slug === "refurb" ? "product" : "website";
  const twitterCard = absImg ? "summary_large_image" : "summary";

  return (
    <Helmet>
      <title>{title}</title>

      {/* Canonical */}
      <link rel="canonical" href={canonical} />

      {/* Meta */}
      {description ? <meta name="description" content={description} /> : null}
      <meta name="robots" content={robots} />

      {/* Open Graph */}
      <meta property="og:site_name" content={SEO_CONFIG.siteName} />
      <meta property="og:title" content={title} />
      {description ? (
        <meta property="og:description" content={description} />
      ) : null}
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={ogType} />
      {absImg ? <meta property="og:image" content={absImg} /> : null}

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      {description ? (
        <meta name="twitter:description" content={description} />
      ) : null}
      {absImg ? <meta name="twitter:image" content={absImg} /> : null}
    </Helmet>
  );
}
