// src/components/CompareBanner.jsx
import React from "react";

function fmtMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : `$${v}`;
}

/**
 * CompareBanner
 *
 * Modes:
 * - mode="part"  → you're on the NEW part page
 * - mode="offer" → you're on the REFURBISHED / offer page
 *
 * Props:
 * - summary:        legacy prop, treated as refurbSummary (for backwards compat)
 * - refurbSummary:  { price, url, totalQty }
 * - newSummary:     { price, url, status } // status: "in_stock" | "special_order" | "unavailable" | undefined
 */
export default function CompareBanner({
  mode = "part",
  summary, // legacy: treated as refurbSummary
  refurbSummary,
  newSummary,
  className = "",
}) {
  // Backwards compat: if caller still uses `summary`, treat that as refurbSummary
  const refurb = refurbSummary || summary || null;
  const newPart = newSummary || null;

  // No refurbished option → no banner
  if (!refurb || refurb.price == null) return null;

  const refurbPrice =
    typeof refurb.price === "number" ? refurb.price : Number(refurb.price);
  const refurbQty = refurb.totalQty || 0;
  const refurbAvailable = refurbQty > 0;

  const newPrice =
    newPart && newPart.price != null ? Number(newPart.price) : null;
  const newStatus = (newPart && newPart.status) || "unknown";

  const hasNewPrice = newPrice != null && Number.isFinite(newPrice);
  const hasRefurbPrice =
    refurbPrice != null && Number.isFinite(refurbPrice);

  const refurbCheaper =
    hasNewPrice && hasRefurbPrice && refurbPrice < newPrice;

  const newIsInStock = newStatus === "in_stock";
  const newIsSpecialOrder = newStatus === "special_order";
  const newIsUnavailable = newStatus === "unavailable";

  const anyRefurb = refurbAvailable || hasRefurbPrice;

  let labelParts = [];

  /* =========================================================
     MODE: NEW PART PAGE (mode="part")
     ========================================================= */
  if (mode === "part") {
    if (!anyRefurb) return null;

    // New part in stock, refurbished cheaper → focus on savings
    if (newIsInStock && refurbCheaper) {
      const savings = newPrice - refurbPrice;
      labelParts.push(
        `Refurbished OEM part ${fmtMoney(refurbPrice)}`
      );
      labelParts.push(`Saves ${fmtMoney(savings)} vs new`);
    }
    // New part in stock, refurbished not cheaper → alternative option
    else if (newIsInStock) {
      labelParts.push(
        `Refurbished OEM part ${fmtMoney(refurbPrice)} also available`
      );
    }
    // New part special order → speed/availability value
    else if (newIsSpecialOrder) {
      labelParts.push("New part is special order");
      labelParts.push(
        `Refurbished OEM part ${fmtMoney(refurbPrice)} available now`
      );
    }
    // New part unavailable / no clear source
    else if (newIsUnavailable || !newPart) {
      labelParts.push("This new part isn’t currently in stock");
      labelParts.push(
        `Refurbished OEM part available for ${fmtMoney(refurbPrice)}`
      );
    }
    // Unknown status → simple refurbished option
    else {
      labelParts.push(
        `Refurbished OEM part ${fmtMoney(refurbPrice)} available`
      );
    }

    if (refurbAvailable) {
      labelParts.push(`${refurbQty} in stock`);
    }
  }

  /* =========================================================
     MODE: REFURBISHED OFFER PAGE (mode="offer")
     ========================================================= */
  else if (mode === "offer") {
    if (!anyRefurb) return null;

    const newUsableForCompare =
      hasNewPrice && (newIsInStock || newIsSpecialOrder);

    // We know the new price and refurbished is cheaper
    if (newUsableForCompare && refurbCheaper) {
      const savings = newPrice - refurbPrice;
      labelParts.push(
        `Refurbished OEM part ${fmtMoney(refurbPrice)}`
      );
      labelParts.push(
        `Saves ${fmtMoney(savings)} vs new (${fmtMoney(newPrice)})`
      );
    }
    // New part in stock / special order but not cheaper
    else if (newUsableForCompare) {
      labelParts.push(
        `Refurbished OEM part ${fmtMoney(refurbPrice)}`
      );
      labelParts.push(`New part ${fmtMoney(newPrice)} also available`);
    }
    // New is special order / unavailable / unknown / missing
    else if (newIsSpecialOrder) {
      labelParts.push("New part is special order");
      labelParts.push(
        `Refurbished OEM part ${fmtMoney(refurbPrice)} available now`
      );
    } else if (newIsUnavailable || !newPart) {
      labelParts.push("New part isn’t currently in stock");
      labelParts.push(
        `Refurbished OEM part available for ${fmtMoney(refurbPrice)}`
      );
    } else {
      // Fallback
      labelParts.push(
        `Refurbished OEM part ${fmtMoney(refurbPrice)} available`
      );
    }

    if (refurbAvailable) {
      labelParts.push(`${refurbQty} in stock`);
    }
  }

  /* =========================================================
     UNKNOWN MODE → safest simple message
     ========================================================= */
  else {
    labelParts.push(
      `Refurbished OEM part ${fmtMoney(refurbPrice)} available`
    );
    if (refurbAvailable) {
      labelParts.push(`${refurbQty} in stock`);
    }
  }

  const label = labelParts.filter(Boolean).join(" • ");

  const baseClasses =
    "inline-flex items-center justify-center rounded px-2 py-1 text-xs shadow " +
    "bg-red-600 text-white hover:bg-red-700 transition-colors " + // 🔴 changed to red
    "max-w-full overflow-hidden text-ellipsis whitespace-nowrap";

  const content = (
    <span
      className="inline-block align-middle"
      title={label}
      aria-label={label}
    >
      {label}
    </span>
  );

  // Click behavior:
  // - On NEW part page: tap → refurbished offer
  // - On REFURB page: tap → new part if we know it, else stay on refurb
  let targetUrl = null;
  if (mode === "part") {
    targetUrl = refurb?.url || (summary && summary.url) || null;
  } else if (mode === "offer") {
    targetUrl =
      (newPart && newPart.url) ||
      refurb?.url ||
      (summary && summary.url) ||
      null;
  }

  if (targetUrl) {
    return (
      <a href={targetUrl} className={`${baseClasses} ${className}`}>
        {content}
      </a>
    );
  }

  return <div className={`${baseClasses} ${className}`}>{content}</div>;
}
