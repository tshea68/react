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
 * - mode="part"  → you're on the NEW/OEM part page
 * - mode="offer" → you're on the REFURB / offer page
 *
 * Props:
 * - summary:        legacy prop, treated as refurbSummary (for backwards compat)
 * - refurbSummary:  { price, url, totalQty }
 * - newSummary:     { price, url, status } // status: "in_stock" | "special_order" | "unavailable" | undefined
 *
 * Logic (per user spec):
 *
 * On PART pages (mode="part"):
 *   1) If OEM is special order / unavailable AND refurb exists:
 *        Label: "Refurb from $X • OEM special order/unavailable • N available"
 *   2) Else if refurb cheaper than new:
 *        Label: "Save $X with refurb • Refurb from $Y • N available"
 *
 * On OFFER pages (mode="offer"):
 *   1) If both are available and refurb cheaper:
 *        Label: "This refurb is $X cheaper than new • OEM $Y"
 *   2) If only the offer is actually available (OEM special order/unavailable/unknown):
 *        Label: "OEM special order/unavailable • Refurb available now from $X"
 */
export default function CompareBanner({
  mode = "part",
  summary,          // legacy: treated as refurbSummary
  refurbSummary,
  newSummary,
  className = "",
}) {
  // Backwards compat: if caller still uses `summary`, treat that as refurbSummary
  const refurb = refurbSummary || summary || null;
  const newPart = newSummary || null;

  if (!refurb || refurb.price == null) return null;

  const refurbPrice =
    typeof refurb.price === "number" ? refurb.price : Number(refurb.price);
  const refurbAvailable = (refurb.totalQty || 0) > 0;
  const refurbQty = refurb.totalQty || 0;

  const newPrice =
    newPart && newPart.price != null
      ? Number(newPart.price)
      : null;

  const newStatus = (newPart && newPart.status) || "unknown";

  // Helper flags
  const hasNewPrice = newPrice != null && Number.isFinite(newPrice);
  const hasRefurbPrice =
    refurbPrice != null && Number.isFinite(refurbPrice);

  const refurbCheaper =
    hasNewPrice && hasRefurbPrice && refurbPrice < newPrice;

  const oemIsSpecialOrUnavailable =
    newStatus === "special_order" || newStatus === "unavailable";

  const anyRefurb = refurbAvailable || hasRefurbPrice;

  // Decide label text based on mode
  let labelParts = [];

  if (mode === "part") {
    // ─────────────────────────────────────
    // PART PAGE LOGIC
    // ─────────────────────────────────────

    // 2) "This is special order/unavailable and there is a refurb available"
    if (anyRefurb && oemIsSpecialOrUnavailable) {
      labelParts.push(`Refurb from ${fmtMoney(refurbPrice)}`);

      if (newStatus === "special_order") {
        labelParts.push("OEM is special order only");
      } else if (newStatus === "unavailable") {
        labelParts.push("OEM currently unavailable");
      }

      if (refurbQty > 0) {
        labelParts.push(`${refurbQty} available`);
      }
    }
    // 1) "There is a cheaper refurb, save X"
    else if (anyRefurb && refurbCheaper) {
      const savings = newPrice - refurbPrice;
      labelParts.push(`Save ${fmtMoney(savings)} with refurb`);
      labelParts.push(`Refurb from ${fmtMoney(refurbPrice)}`);
      if (refurbQty > 0) {
        labelParts.push(`${refurbQty} available`);
      }
    } else {
      // Fallback: simple refurb tease if nothing else fits
      labelParts.push(`Refurb from ${fmtMoney(refurbPrice)}`);
      if (refurbQty > 0) {
        labelParts.push(`${refurbQty} available`);
      }
    }
  } else if (mode === "offer") {
    // ─────────────────────────────────────
    // OFFER PAGE LOGIC
    // ─────────────────────────────────────

    // 1) if both are available - "this is X cheaper than new"
    const oemAvailableForCompare =
      hasNewPrice &&
      (newStatus === "in_stock" || newStatus === "special_order");

    if (anyRefurb && oemAvailableForCompare && refurbCheaper) {
      const savings = newPrice - refurbPrice;
      labelParts.push(
        `This refurb is ${fmtMoney(savings)} cheaper than new`
      );
      labelParts.push(`OEM new ${fmtMoney(newPrice)}`);
    }
    // 2) If only the offer is actually available
    else if (anyRefurb && (oemIsSpecialOrUnavailable || !newPart)) {
      if (newStatus === "special_order") {
        labelParts.push(
          "OEM part is special order only; refurb available now"
        );
      } else if (newStatus === "unavailable") {
        labelParts.push(
          "OEM part is unavailable; refurb available now"
        );
      } else {
        labelParts.push(
          "No current OEM source; refurb available now"
        );
      }
      labelParts.push(`From ${fmtMoney(refurbPrice)}`);
    } else {
      // Fallback
      labelParts.push(`Refurb from ${fmtMoney(refurbPrice)}`);
      if (hasNewPrice) {
        labelParts.push(`OEM ${fmtMoney(newPrice)}`);
      }
    }
  } else {
    // Unknown mode → safest is old behavior
    labelParts.push(`Refurb from ${fmtMoney(refurbPrice)}`);
    if (refurbQty > 0) {
      labelParts.push(`${refurbQty} available`);
    }
  }

  const label = labelParts.filter(Boolean).join(" • ");

  const baseClasses =
    "inline-flex items-center justify-center rounded px-2 py-1 text-xs shadow " +
    "bg-emerald-600 text-white hover:bg-emerald-700 transition-colors " +
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

  // Decide where the click goes:
  // - On PART page: link to refurb (if we have refurb URL)
  // - On OFFER page: link to OEM new (if we have its URL), else refurb URL
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
