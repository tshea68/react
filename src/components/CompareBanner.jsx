// src/components/CompareBanner.jsx
import React from "react";
import { Link } from "react-router-dom";

function fmtMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : `$${v}`;
}

export default function CompareBanner({ summary, className = "" }) {
  // summary shape example:
  // {
  //   mpn: "00145327",
  //   price: 129.95,
  //   totalQty: 4,
  //   bestOffer: { listing_id: "205062137434" },
  //   savings: { amount: 80 }
  // }

  if (!summary || summary.price == null) return null;

  const hasSavings =
    summary.savings && summary.savings.amount != null;

  const label = [
    `Refurb from ${fmtMoney(summary.price)}`,
    hasSavings ? `Save ${fmtMoney(summary.savings.amount)}` : null,
    summary.totalQty > 0 ? `${summary.totalQty} available` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  // ------------------------------------------------------------
  // INTERNAL URL ROUTING LOGIC (this is the important part)
  // ------------------------------------------------------------

  let internalUrl = null;

  // If refurb offers exist
  if (summary?.bestOffer?.listing_id) {
    internalUrl = `/refurb/${summary.mpn}?offer=${summary.bestOffer.listing_id}`;
  } 
  
  // Fallback: go to the OEM part page
  else {
    internalUrl = `/parts/${summary.mpn}`;
  }

  // ------------------------------------------------------------

  const baseClasses =
    "rounded px-2 py-1 text-xs shadow bg-emerald-600 text-white " +
    "hover:bg-emerald-700 transition-colors inline-block " +
    "max-w-full overflow-hidden text-ellipsis whitespace-nowrap";

  const content = (
    <span className="inline-block align-middle" title={label} aria-label={label}>
      {label}
    </span>
  );

  return (
    <Link to={internalUrl} className={`${baseClasses} ${className}`}>
      {content}
    </Link>
  );
}
