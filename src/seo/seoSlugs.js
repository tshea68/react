// src/seo/seoSlugs.js
import { SEO_CONFIG, clampDescription } from "./seoConfig";

// Small helper: join non-empty unique tokens cleanly
function uniqJoin(items, sep = " · ") {
  const seen = new Set();
  const out = [];
  for (const raw of items || []) {
    const v = (raw || "").toString().trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.join(sep);
}

/**
 * This file is your “Yoast customization panel”.
 * Each slug returns a function that receives:
 *   { pathname, data, params }
 * and outputs:
 *   { title, description, canonical, robots }
 *
 * `data` can be ANY shape you want—whatever your page already has.
 * The builders below are defensive, so missing fields won’t break your page.
 */

export const SEO_SLUGS = {
  // Home / Parts Explorer
  home: ({ pathname }) => {
    const title = `${SEO_CONFIG.siteName} — New & Refurbished OEM Appliance Parts`;
    const description = clampDescription(SEO_CONFIG.tagline);
    return {
      title,
      description,
      canonical: SEO_CONFIG.canonicalOrigin + (pathname || "/"),
      robots: SEO_CONFIG.defaultRobots,
    };
  },

  // Model page (e.g. /model?number=XYZ or your internal model route)
  model: ({ pathname, data }) => {
    const brand = data?.brand || "";
    const modelNumber = data?.model_number || data?.modelNumber || "";
    const applianceType = data?.appliance_type || data?.applianceType || "";

    const core = uniqJoin([brand, applianceType, modelNumber], " ");
    const title = core
      ? `${core} Parts & Diagrams — ${SEO_CONFIG.siteName}`
      : `Model Parts & Diagrams — ${SEO_CONFIG.siteName}`;

    // Description: tagline + optional model context
    const extra = uniqJoin(
      [
        brand ? `Brand: ${brand}` : "",
        applianceType ? `Appliance: ${applianceType}` : "",
        modelNumber ? `Model: ${modelNumber}` : "",
      ],
      ". "
    );

    const description = clampDescription(
      extra ? `${SEO_CONFIG.tagline} ${extra}.` : SEO_CONFIG.tagline
    );

    return {
      title,
      description,
      canonical: SEO_CONFIG.canonicalOrigin + (pathname || "/model"),
      robots: SEO_CONFIG.defaultRobots,
    };
  },

  // New part page (/parts/:mpn)
  part: ({ pathname, data, params }) => {
    const mpn = params?.mpn || data?.mpn || data?.part_number || "";
    const brand = data?.brand || "";
    const applianceType = data?.appliance_type || data?.applianceType || "";
    const name = data?.name || data?.title || "";

    // Title should be specific: MPN + human name if available
    const titleCore = uniqJoin(
      [
        mpn,
        name && name !== mpn ? name : "",
        brand,
        applianceType ? `${applianceType} Part` : "",
      ],
      " — "
    );

    const title = titleCore
      ? `${titleCore} | ${SEO_CONFIG.siteName}`
      : `Appliance Part | ${SEO_CONFIG.siteName}`;

    // Description: tagline + a small product-specific line if you have it
    const productLine = uniqJoin(
      [
        brand ? `Brand: ${brand}` : "",
        applianceType ? `Appliance: ${applianceType}` : "",
        mpn ? `Part #${mpn}` : "",
      ],
      ". "
    );

    const description = clampDescription(
      productLine ? `${SEO_CONFIG.tagline} ${productLine}.` : SEO_CONFIG.tagline
    );

    return {
      title,
      description,
      canonical: SEO_CONFIG.canonicalOrigin + (pathname || "/"),
      robots: SEO_CONFIG.defaultRobots,
    };
  },

  // Refurb page (/refurb/:mpn) — still canonical to its own URL, but same pattern
  refurb: ({ pathname, data, params }) => {
    const mpn = params?.mpn || data?.mpn || data?.part_number || "";
    const brand = data?.brand || "";
    const applianceType = data?.appliance_type || data?.applianceType || "";
    const name = data?.name || data?.title || "";

    const titleCore = uniqJoin(
      [
        mpn,
        name && name !== mpn ? name : "",
        brand,
        applianceType ? `${applianceType} Refurbished Part` : "Refurbished Part",
      ],
      " — "
    );

    const title = titleCore
      ? `${titleCore} | ${SEO_CONFIG.siteName}`
      : `Refurbished Appliance Part | ${SEO_CONFIG.siteName}`;

    const productLine = uniqJoin(
      [
        "Refurbished OEM part",
        brand ? `Brand: ${brand}` : "",
        applianceType ? `Appliance: ${applianceType}` : "",
        mpn ? `Part #${mpn}` : "",
      ],
      ". "
    );

    const description = clampDescription(
      productLine ? `${SEO_CONFIG.tagline} ${productLine}.` : SEO_CONFIG.tagline
    );

    return {
      title,
      description,
      canonical: SEO_CONFIG.canonicalOrigin + (pathname || "/"),
      robots: SEO_CONFIG.defaultRobots,
    };
  },

  // Private / non-index pages
  cart: ({ pathname }) => ({
    title: `Cart | ${SEO_CONFIG.siteName}`,
    description: clampDescription(SEO_CONFIG.tagline),
    canonical: SEO_CONFIG.canonicalOrigin + (pathname || "/cart"),
    robots: SEO_CONFIG.privateRobots,
  }),

  checkout: ({ pathname }) => ({
    title: `Checkout | ${SEO_CONFIG.siteName}`,
    description: clampDescription(SEO_CONFIG.tagline),
    canonical: SEO_CONFIG.canonicalOrigin + (pathname || "/checkout"),
    robots: SEO_CONFIG.privateRobots,
  }),

  success: ({ pathname }) => ({
    title: `Order Confirmation | ${SEO_CONFIG.siteName}`,
    description: clampDescription(SEO_CONFIG.tagline),
    canonical: SEO_CONFIG.canonicalOrigin + (pathname || "/success"),
    robots: SEO_CONFIG.privateRobots,
  }),

  orderStatus: ({ pathname }) => ({
    title: `Order Status | ${SEO_CONFIG.siteName}`,
    description: clampDescription(SEO_CONFIG.tagline),
    canonical: SEO_CONFIG.canonicalOrigin + (pathname || "/order"),
    robots: SEO_CONFIG.privateRobots,
  }),
};

