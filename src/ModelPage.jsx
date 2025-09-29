// src/ModelPage.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import PartImage from "./components/PartImage";

import useVisible from "./hooks/useVisible";
// NOTE: we still use useCompareOnVisible for the right-side "All Known Parts" rows,
// but NOT for the Available grid (that now uses bulk compare).
import useCompareOnVisible from "./hooks/useCompareOnVisible";

const API_BASE = import.meta.env.VITE_API_URL;

/* ---------------- helpers ---------------- */
const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

const extractMPN = (p) => {
  let mpn =
    p?.mpn ??
    p?.mpn_normalized ??
    p?.MPN ??
    p?.part_number ??
    p?.partNumber ??
    p?.mpn_raw ??
    p?.listing_mpn ??
    null;
  if (!mpn && p?.reliable_sku) {
    mpn = String(p.reliable_sku).replace(/^[A-Z]{2,}\s+/, "");
  }
  return mpn ? String(mpn).trim() : "";
};

const numericPrice = (p) => {
  const n =
    p?.price_num ??
    p?.price_numeric ??
    (typeof p?.price === "number"
      ? p.price
      : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
  return Number.isFinite(Number(n)) ? Number(n) : null;
};

const formatPrice = (v, curr = "USD") => {
  const n =
    typeof v === "number"
      ? v
      : v?.price_num ??
        v?.price_numeric ??
        (typeof v?.price === "number"
          ? v.price
          : Number(String(v?.price || "").replace(/[^0-9.]/g, "")));
  if (n == null || Number.isNaN(Number(n))) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (v?.currency || curr || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(Number(n));
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
};

const stockBadge = (raw) => {
  const s = String(raw || "").toLowerCase();
  if (/special/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">
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

/* ---------------- main ---------------- */
const ModelPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const modelNumber = searchParams.get("model") || "";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);
  const [loadingParts, setLoadingParts] = useState(false);
  const [brandLogos, setBrandLogos] = useState([]);

  const availRootRef = useRef(null);
  const knownRootRef = useRef(null);

  // Bulk compare cache + results for current view
  const bulkCacheRef = useRef(new Map()); // key -> {refurb:{price,url}, reliable:{price,stock_status}}
  const [compareBulk, setCompareBulk] = useState({}); // visible map for current keys
  const [refurbFlags, setRefurbFlags] = useState({}); // key -> boolean (has refurb)

  // (Kept for completeness; no longer used by Available grid)
  const onRefurbFlag = useCallback((_key, _hasRefurb) => {}, []);

  useEffect(() => {
    const fetchModel = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/models/search?q=${encodeURIComponent(modelNumber)}`);
        const data = await res.json();
        setModel(data && data.model_number ? data : null);
      } catch (err) {
        console.error("❌ Error loading model data:", err);
        setError("Error loading model data.");
      }
    };

    const fetchParts = async () => {
      try {
        setLoadingParts(true);
        const res = await fetch(`${API_BASE}/api/parts/for-model/${encodeURIComponent(modelNumber)}`);
        if (!res.ok) throw new Error("Failed to fetch parts");
        const data = await res.json();
        setParts({
          all: Array.isArray(data.all) ? data.all : [],
          priced: Array.isArray(data.priced) ? data.priced : [],
        });
      } catch (err) {
        console.error("❌ Error loading parts:", err);
      } finally {
        setLoadingParts(false);
      }
    };

    const fetchBrandLogos = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/brand-logos`);
        const data = await res.json();
        setBrandLogos(Array.isArray(data) ? data : data?.logos || []);
      } catch (err) {
        console.error("❌ Error fetching brand logos:", err);
      }
    };

    if (modelNumber) {
      fetchModel();
      fetchParts();
      fetchBrandLogos();
    }

    const input = document.querySelector("input[type='text']");
    if (input) input.value = "";
  }, [modelNumber, location]);

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  const allKnownOrdered = useMemo(() => {
    const list = Array.isArray(parts.all) ? [...parts.all] : [];
    list.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    return list;
  }, [parts.all]);

  // Build base "available" rows (new parts + capped refurb-only candidates)
  const availableRowsBase = useMemo(() => {
    const seen = new Set();
    const out = [];

    const pricedMap = new Map();
    for (const p of parts.priced || []) {
      const k = normalize(extractMPN(p));
      if (k) pricedMap.set(k, p);
    }

    // include all priced/new parts first (stable order)
    for (const [k, p] of pricedMap.entries()) {
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ key: k, newPart: p });
      }
    }

    // add refurb-only candidates (no new part) – capped
    const MAX_REFURB_ONLY = 100;
    for (const row of allKnownOrdered) {
      if (out.length >= pricedMap.size + MAX_REFURB_ONLY) break;
      const k = normalize(extractMPN(row));
      if (!k || seen.has(k)) continue;
      if (!pricedMap.has(k)) {
        seen.add(k);
        out.push({ key: k, newPart: null });
      }
    }

    return out;
  }, [parts.priced, allKnownOrdered]);

  /* ---------- BULK COMPARE: prefetch refurb + new info for all visible keys ---------- */
  useEffect(() => {
    const keys = availableRowsBase.map(r => r.key).filter(Boolean);
    if (!keys.length) {
      setCompareBulk({});
      setRefurbFlags({});
      return;
    }

    const applyFromCache = () => {
      const map = {};
      const flags = {};
      keys.forEach(k => {
        const v = bulkCacheRef.current.get(k);
        if (v) {
          map[k] = v;
          if (v?.refurb?.price != null) flags[k] = true;
        }
      });
      setCompareBulk(map);
      setRefurbFlags(flags);
    };

    // Which keys are missing in cache?
    const missing = keys.filter(k => !bulkCacheRef.current.has(k));
    if (missing.length === 0) {
      applyFromCache();
      return;
    }

    const CHUNK = 300;
    const chunks = [];
    for (let i = 0; i < missing.length; i += CHUNK) chunks.push(missing.slice(i, i + CHUNK));

    let canceled = false;
    (async () => {
      for (const c of chunks) {
        try {
          const res = await fetch(`${API_BASE}/api/compare/xmarket/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keys: c }),
          });
          const data = res.ok ? await res.json() : { items: {} };
          const items = data?.items || {};
          Object.entries(items).forEach(([k, v]) => bulkCacheRef.current.set(k, v));
        } catch {
          // ignore chunk failure; continue
        }
        if (canceled) return;
      }
      if (!canceled) applyFromCache();
    })();

    return () => { canceled = true; };
  }, [availableRowsBase]);

  // Sort with refurb-at-top using refurbFlags (computed from bulk)
  const availableRowsSorted = useMemo(() => {
    const arr = [...availableRowsBase];
    arr.sort((a, b) => {
      const ar = !!refurbFlags[a.key];
      const br = !!refurbFlags[b.key];
      if (ar !== br) return ar ? -1 : 1; // refurb first
      // secondary: keep new parts before refurb-only (stable-ish)
      const ai = a.newPart ? 0 : 1;
      const bi = b.newPart ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return 0;
    });
    return arr;
  }, [availableRowsBase, refurbFlags]);

  const refurbCount = useMemo(
    () => Object.values(refurbFlags).reduce((acc, v) => acc + (v ? 1 : 0), 0),
    [refurbFlags]
  );

  if (error) return <div className="text-red-600 text-center py-6">{error}</div>;
  if (!model) return null;

  return (
    <div className="w-[90%] mx-auto pb-12">
      {/* Breadcrumb */}
      <div className="w-full border-b border-gray-200 mb-4">
        <nav className="text-sm text-gray-600 py-2 w-full">
          <ul className="flex space-x-2">
            <li>
              <Link to="/" className="hover:underline text-blue-600">Home</Link>
              <span className="mx-1">/</span>
            </li>
            <li className="font-semibold text-black">
              {model.brand} {model.appliance_type} {model.model_number}
            </li>
          </ul>
        </nav>
      </div>

      {/* Header section */}
      <div className="border rounded p-2 flex items-center mb-4 gap-3 max-h-[100px] overflow-hidden">
        <div className="w-1/6 flex items-center justify-center">
          {getBrandLogoUrl(model.brand) ? (
            <img
              src={getBrandLogoUrl(model.brand)}
              alt={`${model.brand} Logo`}
              className="object-contain h-14"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="text-[10px] text-gray-500">No Logo</span>
          )}
        </div>

        <div className="w-5/6 bg-gray-500/30 rounded p-2 flex items-center gap-3 overflow-hidden">
          <div className="w-1/3 leading-tight">
            <h2 className="text-sm font-semibold truncate">
              {model.brand} - {model.model_number} - {model.appliance_type}
            </h2>
            <p className="text-[11px] mt-1 text-gray-700">
              Known Parts: {parts.all.length} &nbsp;|&nbsp; Priced Parts: {parts.priced.length}
            </p>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-2">
            {model.exploded_views?.map((view, idx) => (
              <div key={idx} className="w-24 shrink-0">
                <div className="border rounded p-1 bg-white hover:shadow transition">
                  <img
                    src={view.image_url}
                    alt={view.label}
                    className="w-full h-14 object-contain cursor-pointer"
                    loading="lazy"
                    decoding="async"
                    onClick={() => setPopupImage(view.image_url)}
                    onError={(e) => (e.currentTarget.src = "/no-image.png")}
                  />
                  <p className="text-[10px] text-center mt-1 leading-tight truncate">{view.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popup Image */}
      {popupImage && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <button
            className="absolute top-4 right-4 bg-white/90 rounded px-3 py-1 text-sm shadow hover:bg-white"
            onClick={() => setPopupImage(null)}
          >
            ✕ Close
          </button>
          <img src={popupImage} alt="Popup" className="max-h-[90vh] max-w-[90vw]" />
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Available Parts (75%) */}
        <div className="md:w-3/4">
          <h3 className="text-lg font-semibold mb-2">
            Available Parts{" "}
            {refurbCount > 0 && (
              <span className="ml-2 text-sm text-gray-700 font-medium">[{refurbCount} refurbished]</span>
            )}
          </h3>

          {loadingParts ? (
            <p className="text-gray-500">Loading parts…</p>
          ) : availableRowsSorted.length === 0 ? (
            <p className="text-gray-500 mb-6">No priced parts available for this model.</p>
          ) : (
            <div
              ref={availRootRef}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1"
            >
              {availableRowsSorted.map(({ key, newPart }) => (
                <AvailCard
                  key={key}
                  mpnKey={key}
                  newPart={newPart}
                  apiBase={API_BASE}
                  rootRef={availRootRef}
                  onRefurbFlag={onRefurbFlag}
                  compareEntry={compareBulk[key]} // <<— use prefetched refurb/new info
                />
              ))}
            </div>
          )}
        </div>

        {/* All Known Parts (25%) */}
        <div className="md:w-1/4">
          <h3 className="text-lg font-semibold mb-2">All Known Parts</h3>
          {allKnownOrdered.length === 0 ? (
            <p className="text-gray-500">No parts found for this model.</p>
          ) : (
            <div ref={knownRootRef} className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
              {allKnownOrdered.map((p, idx) => (
                <AllKnownRow
                  key={`${p.mpn || idx}`}
                  row={p}
                  priced={findPriced(parts.priced, p)}
                  apiBase={API_BASE}
                  rootRef={knownRootRef}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------------- subcomponents ---------------- */

function AvailCard({ mpnKey, newPart, apiBase, rootRef, onRefurbFlag, compareEntry }) {
  const { ref: cardRef } = useVisible({ rootRef });
  // compareEntry looks like: { refurb: {price, url}, reliable: {price, stock_status} }
  const refurb = compareEntry?.refurb || null;
  const reliable = compareEntry?.reliable || null;

  // (no-op now; kept to avoid prop churn)
  React.useEffect(() => {
    onRefurbFlag?.(mpnKey, !!(refurb && refurb.price != null));
  }, [mpnKey, refurb, onRefurbFlag]);

  const mpn = newPart ? extractMPN(newPart) : mpnKey;
  const title = (newPart?.name || mpn || "").trim();
  const newPrice = newPart ? numericPrice(newPart) : (reliable?.price ?? null);

  // refurb-only tile OR "no newPart but refurb exists"
  if (!newPart) {
    if (!refurb || refurb.price == null) {
      // We hide empty refurb-only tiles (no refurb to show)
      return null;
    }
    const refurbPrice = refurb.price;

    let refurbBanner = "No new part available";
    if (reliable && reliable.price != null) {
      const isSpecial = String(reliable.stock_status || "").toLowerCase().includes("special");
      refurbBanner = isSpecial
        ? `New part can be special ordered for ${formatPrice({ price: reliable.price })}`
        : `New part available for ${formatPrice({ price: reliable.price })}`;
    }

    return (
      <div ref={cardRef} className="border rounded p-3 hover:shadow transition">
        <div className="flex gap-4 items-start">
          <div className="w-20 h-20 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">
            MPN
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-gray-700 mb-0.5">Refurbished</div>
            <Link
              to={`/parts/${encodeURIComponent(mpnKey)}`}
              className="line-clamp-2 font-semibold text-[15px] hover:underline"
            >
              {title || mpnKey}
            </Link>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">In stock</span>
              <span className="font-semibold">{formatPrice(refurbPrice)}</span>
            </div>
          </div>
        </div>

        <a
          href={refurb.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full rounded bg-red-600 text-white text-xs px-2 py-1 hover:bg-red-700 text-left"
          onClick={(e) => {
            if (!refurb.url) e.preventDefault();
          }}
          title={refurbBanner}
        >
          {refurbBanner}
        </a>
      </div>
    );
  }

  // new-part tile (with optional refurb banner)
  const refurbPrice = refurb?.price ?? null;
  const savings =
    newPrice != null && refurbPrice != null ? Math.max(0, Number(newPrice) - Number(refurbPrice)) : null;

  return (
    <div ref={cardRef} className="border rounded p-3 hover:shadow transition">
      <div className="flex gap-4 items-start">
        <PartImage
          imageUrl={newPart.image_url}
          imageKey={newPart.image_key}
          mpn={newPart.mpn}
          alt={newPart.name}
          className="w-20 h-20 object-contain"
          imgProps={{ loading: "lazy", decoding: "async" }}
        />

        <div className="min-w-0 flex-1">
          <Link
            to={`/parts/${encodeURIComponent(extractMPN(newPart))}`}
            className="line-clamp-2 font-semibold text-[15px] hover:underline"
          >
            {newPart.name || extractMPN(newPart)}
          </Link>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {stockBadge(newPart?.stock_status)}
            {newPrice != null ? <span className="font-semibold">{formatPrice(newPrice)}</span> : null}
          </div>
        </div>
      </div>

      {refurbPrice != null ? (
        <a
          href={refurb?.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full rounded bg-red-600 text-white text-xs px-2 py-1 hover:bg-red-700 text-left"
          onClick={(e) => {
            if (!refurb?.url) e.preventDefault();
          }}
          title={
            savings != null
              ? `Refurbished available for ${formatPrice(refurbPrice)} (Save ${formatPrice(savings)})`
              : `Refurbished available for ${formatPrice(refurbPrice)}`
          }
        >
          Refurbished available for {formatPrice(refurbPrice)}
          {savings != null ? ` (Save ${formatPrice(savings)})` : ""}
        </a>
      ) : null}
    </div>
  );
}

function AllKnownRow({ row, priced, apiBase, rootRef }) {
  const mpn = extractMPN(row);
  const key = normalize(mpn);
  const { ref: rowRef, isVisible } = useVisible({ rootRef });
  // Keep lazy compare here to avoid hammering bulk for hundreds of “known” rows
  const cmp = useCompareOnVisible({ key, visible: isVisible, apiBase });

  const price = priced ? numericPrice(priced) : null;

  return (
    <div ref={rowRef} className="border rounded p-3 hover:shadow transition">
      <div className="text-xs text-gray-500 mb-1">
        {row.sequence != null ? `Diagram #${row.sequence}` : "Diagram #–"}
      </div>

      <div className="text-sm font-medium line-clamp-2">
        {row.name || mpn}
      </div>

      <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
        {priced ? stockBadge(priced?.stock_status) : stockBadge("unavailable")}
        {price != null ? <span className="font-semibold">{formatPrice(price)}</span> : null}
      </div>

      {cmp && cmp.price != null ? (
        <a
          href={cmp.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full rounded bg-red-600 text-white text-xs px-2 py-1 hover:bg-red-700 text-left"
          onClick={(e) => {
            if (!cmp.url) e.preventDefault();
          }}
        >
          Refurbished available for {formatPrice(cmp.price)}
        </a>
      ) : null}
    </div>
  );
}

function findPriced(pricedList, row) {
  const mpn = extractMPN(row);
  const key = normalize(mpn);
  if (!key) return null;
  for (const p of pricedList || []) {
    const k = normalize(extractMPN(p));
    if (k === key) return p;
  }
  return null;
}

export default ModelPage;

