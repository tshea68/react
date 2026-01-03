// src/components/RefurbBadge.jsx
import React from "react";

export default function RefurbBadge({
  newExists,
  newStatus,
  newPrice,
  refurbPrice,
  compact = false,
}) {
  let text = null;

  // Priority order (first match wins)
  if (!newExists) {
    text = "no longer manufactured new";
  } else if (newStatus === "special_order") {
    text = "new OEM available via backorder";
  } else if (typeof newPrice === "number" && typeof refurbPrice === "number") {
    const diff = newPrice - refurbPrice;
    const threshold = Math.max(25, newPrice * 0.1);
    if (diff >= threshold) {
      text = `$${Math.round(diff)} cheaper than new OEM`;
    }
  }

  if (!text) return null;

  return (
    <span
      className={
        "inline-block align-middle whitespace-nowrap ml-3 text-white/90 " +
        (compact ? "text-[11px]" : "text-xs md:text-sm")
      }
    >
      ({text})
    </span>
  );
}
