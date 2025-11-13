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
 * Expected shape of `summary`:
 * {
 *   price: number|null,
 *   url: string|null,              // INTERNAL refurb URL (/refurb/MPN?offer=...)
 *   savings: { amount: number } | null,
 *   totalQty: number
 * }
 */
export default function CompareBanner({ summary, className = "" }) {
  if (!summary || summary.price == null) return null;

  const hasSavings = summary.savings && summary.savings.amount != null;

  const labelParts = [
    `Refurb from ${fmtMoney(summary.price)}`,
    hasSavings ? `Save ${fmtMoney(summary.savings.amount)}` : null,
    summary.totalQty > 0 ? `${summary.totalQty} available` : null,
  ].filter(Boolean);

  const label = labelParts.join(" • ");

  const baseClasses =
    "inline-flex items-center justify-center rounded px-2 py-1 text-xs shadow " +
    "bg-emerald-600 text-white hover:bg-emerald-700 transition-colors " +
    "max-w-full overflow-hidden text-ellipsis whitespace-nowrap";

  const content = (
    <span className="inline-block align-middle" title={label} aria-label={label}>
      {label}
    </span>
  );

  if (summary.url) {
    return (
      <a
        href={summary.url}
        className={`${baseClasses} ${className}`}
      >
        {content}
      </a>
    );
  }

  return <div className={`${baseClasses} ${className}`}>{content}</div>;
}
