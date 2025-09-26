// src/components/CompareBanner.jsx
import React from "react";

function fmtMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : `$${v}`;
}

export default function CompareBanner({ summary, className = "" }) {
  // Expected shape:
  // summary = {
  //   price: number|null,
  //   url: string|null,
  //   savings: { amount: number, percent?: number } | null,
  //   totalQty: number
  // }

  if (!summary || summary.price == null) return null;

  // Only require amount; percent is optional and NOT displayed
  const hasSavings =
    summary.savings && summary.savings.amount != null;

  const label = [
    `Refurb from ${fmtMoney(summary.price)}`,
    hasSavings ? `Save ${fmtMoney(summary.savings.amount)}` : null,
    summary.totalQty > 0 ? `${summary.totalQty} available` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const baseClasses =
    "absolute top-2 right-2 z-10 rounded px-2 py-1 text-xs shadow " +
    "bg-emerald-600 text-white hover:bg-emerald-700 transition-colors " +
    "max-w-[85%] overflow-hidden text-ellipsis whitespace-nowrap";

  // If we have a URL, render as link; otherwise, render a non-clickable badge.
  const content = (
    <span className="inline-block align-middle" title={label} aria-label={label}>
      {label}
    </span>
  );

  if (summary.url) {
    return (
      <a
        href={summary.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClasses} ${className}`}
      >
        {content}
      </a>
    );
  }

  return <div className={`${baseClasses} ${className}`}>{content}</div>;
}

