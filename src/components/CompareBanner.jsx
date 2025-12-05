// src/components/CompareBanner.jsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * CompareBanner
 *
 * Props:
 *  - mode: "part" (OEM page) or "offer" (refurb page)
 *  - refurbSummary: { price? }
 *  - newSummary: { price?, url? }
 *  - mpn: canonical mpn for building fallback URLs
 */
export default function CompareBanner({
  mode = "part",
  refurbSummary,
  newSummary,
  mpn,
}) {
  const refurbPrice = refurbSummary?.price ?? null;
  const newPrice = newSummary?.price ?? null;

  if (!mpn) return null;
  const mpnSafe = encodeURIComponent(mpn);

  const refurbUrl = `/refurb/${mpnSafe}`;
  const newUrl = `/parts/${mpnSafe}`;

  /** ===============================
   * OEM PAGE → Show “View Refurb”
   * =============================== */
  if (mode === "part") {
    if (refurbPrice == null) return null;

    const label = `View Refurbished OEM Part – starting at $${refurbPrice.toFixed(
      2
    )}`;

    return (
      <Link to={refurbUrl} className="block w-full">
        <div
          className="w-full text-white text-xs md:text-sm font-bold px-3 py-2 text-center rounded"
          style={{ backgroundColor: "#b00000" }}
        >
          {label}
        </div>
      </Link>
    );
  }

  /** ===============================
   * REFURB PAGE → Show “View New”
   * =============================== */
  if (mode === "offer") {
    if (newPrice == null) return null;

    const label = `View New OEM Part – ${newPrice.toFixed(2)}`;

    return (
      <Link to={newUrl} className="block w-full">
        <div
          className="w-full text-white text-xs md:text-sm font-bold px-3 py-2 text-center rounded"
          style={{ backgroundColor: "#b00000" }}
        >
          {label}
        </div>
      </Link>
    );
  }

  return null;
}
