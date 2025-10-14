// src/components/PartsExplorer.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const parseArrayish = (data) => {
  if (Array.isArray(data)) return data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  if (data?.parts && Array.isArray(data.parts)) return data.parts;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
};

const getThumb = (p) => p?.image_url || p?.image || p?.thumbnail_url || null;

const getTrustedMPN = (p) => {
  const clean = (x) => (x == null ? "" : String(x).trim());
  return (
    clean(p?.mpn_coalesced) ||
    clean(p?.mpn_display) ||
    clean(p?.mpn) ||
    clean(p?.manufacturer_part_number) ||
    clean(p?.part_number) ||
    clean(p?.sku) ||
    ""
  );
};

const numericPrice = (p) => {
  const n =
    p?.price_num ??
    p?.price_numeric ??
    (typeof p?.price === "number"
      ? p.price
      : Number(String(p?.price || "").replace(/[^a-z0-9.]/gi, "")));
  return Number.isFinite(Number(n)) ? Number(n) : null;
};

const formatPrice = (pObjOrNumber, curr = "USD") => {
  let price =
    typeof pObjOrNumber === "number"
      ? pObjOrNumber
      : pObjOrNumber?.price_num ??
        pObjOrNumber?.price_numeric ??
        (typeof pObjOrNumber?.price === "number"
          ? pObjOrNumber.price
          : Number(String(pObjOrNumber?.price || "").replace(/[^0-9.]/g, "")));
  if (price == null || Number.isNaN(Number(price))) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (pObjOrNumber?.currency || curr || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(Number(price));
  } catch {
    return `$${Number(price).toFixed(2)}`;
  }
};

const renderStockBadge = (raw, { forceInStock = false } = {}) => {
  if (forceInStock) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
        In stock
      </span>
    );
  }
  const s = String(raw || "").toLowerCase();
  if (/special/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-red-600 text-white">
        Special order
      </span>
    );
  }
  if (/unavailable|out\s*of\s*stock|ended/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
        Unavailable
      </span>
    );
  }
  if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
        In stock
      </span>
    );
  }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
      Unavailable
    </span>
  );
};

const routeForPart = (p) => {
  const mpn = getTrustedMPN(p);
  return mpn ? `/parts/${encodeURIComponent(mpn)}` : "/page-not-found";
};

const routeForRefurb = (p) => {
  const mpn = getTrustedMPN(p);
  if (!mpn) return "/page-not-found";
  const offerId =
    p?.offer_id ?? p?.listing_id ?? p?.ebay_id ?? p?.item_id ?? p?.id ?? null;
  const qs = offerId ? `?offer=${encodeURIComponent(String(offerId))}` : "";
  return `/refurb/${encodeURIComponent(mpn)}${qs}`;
};

const titleFrom = (p, mpn = "") => {
  const brand = (p?.brand ?? "").trim();
  const partType = (p?.part_type ?? "").trim();
  const appliance = (p?.appliance_type ?? p?.applianceType ?? "").trim();
  const trio = [brand, partType, appliance].filter(Boolean);
  if (trio.length >= 2) return trio.join(" / ");
  const t = (p?.title ?? p?.name ?? "").trim();
  if (t) return t;
  return trio[0] || mpn || "";
};

export default function PartsExplorer({
  title = "Products",
  mode = "new",          // "new" | "refurb"
  seedQuery = "",        // optional: e.g. "board", "motor"
  limit = 12,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (mode === "new") params.set("in_stock", "true");
    params.set("q", seedQuery || "");
    const path = mode === "refurb" ? "/api/suggest/refurb" : "/api/suggest/parts";
    return `${API_BASE}${path}?${params.toString()}`;
  }, [mode, seedQuery, limit]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(url);
        const data = await r.json();
        const arr = parseArrayish(data);
        if (!alive) return;
        setItems(arr);
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  if (!loading && items.length === 0) return null;

  return (
    <div>
      <div className={`font-bold ${title ? "text-xl md:text-2xl mb-3" : ""}`}>
        {title}
      </div>

      {loading && (
        <div className="text-gray-600 text-sm flex items-center mb-3 gap-2">
          <svg
            className="animate-spin-clock h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
            <path d="M12 12 L12 5" />
          </svg>
          Loading…
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((p, idx) => {
          const mpn = getTrustedMPN(p);
          const priceText = formatPrice(p);
          const href = mode === "refurb" ? routeForRefurb(p) : routeForPart(p);

          return (
            <Link
              key={`${mode}-${idx}-${mpn || idx}`}
              to={href}
              className="block rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition"
            >
              <div className="flex flex-col items-stretch gap-2">
                {/* Image */}
                {getThumb(p) ? (
                  <img
                    src={getThumb(p)}
                    alt={mpn || "Part"}
                    className="w-full h-24 object-contain rounded border border-gray-200 bg-white"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-24 rounded border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                    No image
                  </div>
                )}

                {/* Title */}
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate capitalize">
                    {titleFrom(p, mpn)}
                  </div>
                </div>

                {/* Price / Stock / MPN */}
                <div className="mt-0.5 flex items-center gap-2 text-[13px]">
                  <span className="font-semibold">{priceText || ""}</span>
                  {renderStockBadge(p?.stock_status, {
                    forceInStock: mode === "refurb",
                  })}
                  {mpn && (
                    <span className="ml-2 text-[11px] font-mono text-gray-600 truncate">
                      MPN: {mpn}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
