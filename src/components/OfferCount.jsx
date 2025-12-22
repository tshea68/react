// src/components/OfferCount.jsx
import React from "react";

/**
 * OfferCount
 * Displays a small "Offers: N" badge for netted refurb cards.
 *
 * Usage:
 *   <OfferCount count={p.refurb_count} />
 *
 * Notes:
 * - This is NOT live inventory. It is a table/listing count.
 * - Renders nothing when count is 0/null/invalid.
 */
export default function OfferCount({
  count,
  label = "Offers",
  className = "",
}) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return null;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50",
        "px-2 py-[2px] text-[11px] text-emerald-800 whitespace-nowrap",
        className,
      ].join(" ")}
      title={`${label}: ${n}`}
    >
      {label}: {n}
    </span>
  );
}
