// src/components/CompareBanner.jsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * CompareBanner
 *
 * Props:
 *  - mode: "part"  → we're on the NEW/OEM part page
 *  - mode: "offer" → we're on the REFURB page
 *  - mpn: canonical MPN (optional; used as fallback for URLs)
 *  - refurbSummary: { price?, totalQty?, totalOffers?, url? }
 *  - newSummary: { price?, url?, status? }
 *      status: "in_stock" | "special_order" | "discontinued" | "unavailable" | "unknown"
 *
 * Visual rules:
 *  - This bar is the RED toggle between new & refurb. It is always red.
 *  - Stock / quantity colors are handled elsewhere (title badges, pills, etc.).
 */

function formatPrice(val) {
  if (val == null) return null;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return null;
  return `$${num.toFixed(2)}`;
}

export default function CompareBanner({
  mode = "part",
  mpn,
  refurbSummary,
  newSummary,
}) {
  if (!refurbSummary || !newSummary) return null;

  const refurbPrice = refurbSummary.price ?? null;
  const newPrice = newSummary.price ?? null;
  const newStatus = newSummary.status ?? "unknown";

  const mpnSafe = mpn ? encodeURIComponent(mpn) : "";

  // Canonical URLs
  const refurbUrl =
    (refurbSummary && refurbSummary.url) ||
    (mode === "part" && mpnSafe ? `/refurb/${mpnSafe}` : null);

  const newUrl =
    (newSummary && newSummary.url) ||
    (mpnSafe ? `/parts/${mpnSafe}` : null);

  const baseClass =
    "w-full mt-2 rounded bg-red-600 hover:bg-red-700 text-white " +
    "text-xs md:text-sm font-semibold px-3 py-2 text-center cursor-pointer";

  /** =========================
   *  OEM / PART PAGE BANNER
   *  ========================= */
  if (mode === "part") {
    // Only show banner if we actually have a refurb price
    const priceStr = formatPrice(refurbPrice);
    if (!priceStr) return null;

    const label = `Refurbished OEM part available – just ${priceStr}`;

    const content = (
      <div className="w-full mt-2">
        <div className={baseClass}>{label}</div>
      </div>
    );

    // Make the whole bar clickable to the refurb page if we can
    if (refurbUrl) {
      return (
        <Link to={refurbUrl} className="block">
          {content}
        </Link>
      );
    }
    return content;
  }

  /** =========================
   *  REFURB / OFFER PAGE BANNER
   *  ========================= */
  if (mode === "offer") {
    // On refurb page we talk about the NEW part.
    // If the new part is discontinued/unavailable or has no price,
    // there is nothing meaningful to toggle to → no banner.
    const priceStr = formatPrice(newPrice);
    if (!priceStr) return null;
    if (newStatus === "discontinued" || newStatus === "unavailable") {
      return null;
    }

    let label;
    if (newStatus === "special_order") {
      // Backorder messaging – red bar stays, text explains it.
      label = `New OEM part available on backorder at ${priceStr} (ships 7–30 days)`;
    } else {
      // in_stock or unknown but priced
      label = `New OEM part available at ${priceStr}`;
    }

    const content = (
      <div className="w-full mt-2">
        <div className={baseClass}>{label}</div>
      </div>
    );

    if (newUrl) {
      return (
        <Link to={newUrl} className="block">
          {content}
        </Link>
      );
    }
    return content;
  }

  return null;
}
