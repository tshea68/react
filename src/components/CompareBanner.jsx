// src/components/CompareBanner.jsx
import React from "react";

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(v) {
  const n = toNumberOrNull(v);
  if (n === null) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * CompareBanner
 *
 * Props:
 *  - mode: "part" | "offer"
 *  - refurbSummary: { price, totalQty? }
 *  - newSummary: { price, status, url? }
 */
export default function CompareBanner({ mode = "part", refurbSummary, newSummary }) {
  const refurbPrice = toNumberOrNull(refurbSummary?.price);
  const refurbQty =
    refurbSummary?.totalQty ??
    refurbSummary?.qty ??
    refurbSummary?.count ??
    null;

  const newPrice = toNumberOrNull(newSummary?.price);
  const status = newSummary?.status || "unknown";

  // If we have neither side, don't render anything.
  if (refurbPrice === null && newPrice === null) return null;

  /* =========================
     MODE: OEM PART PAGE
     ========================= */
  if (mode === "part") {
    // Only show banner if we actually have a refurb price
    if (refurbPrice === null || refurbPrice <= 0) return null;

    let text = `Refurbished OEM part from ${formatMoney(refurbPrice)}`;

    if (newPrice !== null && newPrice > refurbPrice) {
      const savings = newPrice - refurbPrice;
      if (savings > 0) {
        text += ` • Save ${formatMoney(savings)} vs new (${formatMoney(
          newPrice
        )})`;
      }
    }

    if (refurbQty !== null && refurbQty > 0) {
      text += ` • ${refurbQty} in stock`;
    }

    return (
      <div className="mt-1 inline-block bg-red-600 text-white text-[11px] px-2 py-1 rounded font-semibold">
        {text}
      </div>
    );
  }

  /* =========================
     MODE: REFURB OFFER PAGE
     ========================= */
  // On the offer page the main price is already the refurb price.
  // Here we just explain savings and/or new-part status.
  let headline = "";
  let details = "";

  // No new price or explicitly unavailable → "No new OEM part available"
  if (
    newPrice === null ||
    status === "unavailable" ||
    status === "discontinued"
  ) {
    headline = "No new OEM part available.";
  } else if (status === "special_order") {
    // New part is special order only
    if (refurbPrice !== null && refurbPrice > 0 && newPrice > refurbPrice) {
      const savings = newPrice - refurbPrice;
      headline = `You're saving ${formatMoney(
        savings
      )} vs special-order new.`;
    } else {
      headline = "New OEM part only available special order.";
    }
    details = `New OEM price ${formatMoney(newPrice)}.`;
  } else {
    // in_stock or unknown – normal case
    if (refurbPrice !== null && refurbPrice > 0 && newPrice > refurbPrice) {
      const savings = newPrice - refurbPrice;
      headline = `You're saving ${formatMoney(
        savings
      )} vs new OEM (${formatMoney(newPrice)}).`;
    } else {
      headline = `New OEM price ${formatMoney(newPrice)}.`;
    }
  }

  if (!headline) return null;

  return (
    <div className="mt-1 bg-red-600 text-white text-[11px] px-2 py-1 rounded leading-snug">
      <div className="font-semibold">{headline}</div>
      {details && <div className="opacity-90">{details}</div>}
    </div>
  );
}
