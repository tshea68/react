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

  const meta = (typeof builder === "function")
    ? builder({ pathname, data, params })
    : fallback;

  const title = (meta?.title || fallback.title).toString();
  const description = clampDescription(meta?.description || fallback.description);
  const canonical = (meta?.canonical || fallback.canonical).toString();
  const robots = (meta?.robots || fallback.robots).toString();

  return (
    <Helmet>
      <title>{title}</title>

      {/* Canonical */}
      <link rel="canonical" href={canonical} />

      {/* Meta */}
      {description ? <meta name="description" content={description} /> : null}
      <meta name="robots" content={robots} />
    </Helmet>
  );
}

