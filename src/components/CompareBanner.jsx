// src/components/CompareBanner.jsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * CompareBanner
 *
 * Props:
 *  - mode: "part" (OEM page) or "offer" (refurb page)
 *  - mpn: canonical MPN for this page
 *  - refurbSummary: { price?, totalQty?, totalOffers?, url? }
 *  - newSummary: { price?, url?, status? }
 *      status: "in_stock" | "special_order" | "discontinued" | "unavailable" | "unknown"
 */
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
    mode === "part" && mpnSafe
      ? `/refurb/${mpnSafe}`
      : refurbSummary.url || null;

  const newUrl = newSummary.url || (mpnSafe ? `/parts/${mpnSafe}` : null);

  /** =========================
   *  OEM / PART PAGE BANNER
   *  ========================= */
  if (mode === "part") {
    // Only show banner if we actually have a refurb price
    if (refurbPrice == null) return null;

    const label = `Refurbished OEM part available – just $${Number(
      refurbPrice
    ).toFixed(2)}`;

    const content = (
      <div className="w-full mt-2">
        <div className="w-full rounded bg-red-700 hover:bg-red-800 text-white text-[11px] md:text-xs font-semibold px-3 py-1.5 text-center cursor-pointer">
          {label}
        </div>
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
    // On refurb page we talk about the NEW part
    let label = null;
    let className =
      "w-full mt-2 rounded px-3 py-1.5 text-[11px] md:text-xs font-semibold text-center ";

    // No new part at all
    if (
      (newStatus === "discontinued" || newStatus === "unavailable") &&
      !newPrice
    ) {
      label = "New OEM part is no longer available.";
      className += "bg-gray-900 text-white";
      return <div className={className}>{label}</div>;
    }

    // We have a price for the new part
    if (newStatus === "in_stock" && newPrice != null) {
      label = `New OEM part available at $${Number(newPrice).toFixed(2)}`;
    } else if (newStatus === "special_order" && newPrice != null) {
      label = `New OEM part available special order at $${Number(
        newPrice
      ).toFixed(2)}`;
    } else if (newPrice != null) {
      // Unknown status but has a price
      label = `New OEM part available at $${Number(newPrice).toFixed(2)}`;
    } else {
      // No actionable info → no banner
      return null;
    }

    // Red compare bar for the "toggle" between refurb and new
    className += "bg-red-700 hover:bg-red-800 text-white";

    const content = <div className={className}>{label}</div>;

    // Link to the new part page if we have a URL and it's not discontinued
    if (
      newUrl &&
      newStatus !== "discontinued" &&
      newStatus !== "unavailable"
    ) {
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
