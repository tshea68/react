// src/components/CompareBanner.jsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * CompareBanner
 *
 * Props:
 *  - mode: "part" (OEM page) or "offer" (refurb page)
 *  - mpn: canonical MPN for this page
 *  - refurbSummary: { price?, totalQty?, totalOffers? }
 *  - newSummary: { price?, url?, status? }  // status: "in_stock" | "special_order" | "discontinued" | "unavailable" | "unknown"
 */
export default function CompareBanner({ mode = "part", mpn, refurbSummary, newSummary }) {
  if (!refurbSummary || !newSummary) return null;

  const refurbPrice = refurbSummary.price ?? null;
  const newPrice = newSummary.price ?? null;
  const newStatus = newSummary.status ?? "unknown";

  const mpnSafe = mpn ? encodeURIComponent(mpn) : "";

  // Canonical URLs
  const refurbUrl =
    mode === "part" && mpnSafe ? `/refurb/${mpnSafe}` : (refurbSummary.url || null);
  const newUrl =
    newSummary.url || (mpnSafe ? `/parts/${mpnSafe}` : null);

  /** =========================
   *  OEM / PART PAGE BANNER
   *  ========================= */
  if (mode === "part") {
    // Only show banner if we actually have a refurb price
    if (refurbPrice == null) return null;

    const label = `Refurbished OEM part available – just $${Number(refurbPrice).toFixed(
      2
    )}`;

    const content = (
      <div className="w-full mt-2">
        <div className="w-full rounded bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-semibold px-3 py-2 text-center cursor-pointer">
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
      "w-full mt-2 rounded px-3 py-2 text-xs md:text-sm font-semibold text-center ";

    if ((newStatus === "discontinued" || newStatus === "unavailable") && !newPrice) {
      label = "New OEM part is no longer available.";
      className += "bg-gray-700 text-white";
      return <div className={className}>{label}</div>;
    }

    if (newStatus === "in_stock" && newPrice != null) {
      label = `New OEM part available at $${Number(newPrice).toFixed(2)}`;
      className += "bg-green-700 hover:bg-green-800 text-white";
    } else if (newStatus === "special_order" && newPrice != null) {
      label = `New OEM part available special order at $${Number(newPrice).toFixed(
        2
      )}`;
      className += "bg-amber-700 hover:bg-amber-800 text-white";
    } else if (newPrice != null) {
      // Unknown status but has a price
      label = `New OEM part available at $${Number(newPrice).toFixed(2)}`;
      className += "bg-green-700 hover:bg-green-800 text-white";
    } else {
      // No actionable info → no banner
      return null;
    }

    const content = <div className={className}>{label}</div>;

    // Link to the new part page if we have a URL
    if (newUrl && newStatus !== "discontinued" && newStatus !== "unavailable") {
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
