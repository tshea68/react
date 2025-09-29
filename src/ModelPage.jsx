// src/ModelPage.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import PartImage from "./components/PartImage";

import useVisible from "./hooks/useVisible";
import useCompareOnVisible from "./hooks/useCompareOnVisible";
import { prewarmCompare } from "../lib/compareClient"; // NEW

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

  // refurb detection state (key -> boolean) lifted to title/sort level
  const [refurbFlags, setRefurbFlags] = useState({});
  const onRefurbFlag = useCallback((key, hasRefurb) => {
    setRefurbFlags((prev) =>
      prev[key] === hasRefurb ? prev : { ...prev, [key]: hasRefurb }
    );
  }, []);

  useEffect(() => {
    const fetchModel = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/models/search?q=${encodeURIComponent(modelNumber)}`
        );
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
        const res = await fetch(
          `${API_BASE}/api/parts/for-model/${encodeURIComponent(modelNumber)}`
        );
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

    // nuke any header input ghost value
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

  // NEW: Prewarm compare results for the first handful of MPNs so badges are ready
  useEffect(() => {
    if (!availableRowsBase?.length) return;

    const keys = availableRowsBase
      .map((r) => r.key)
      .filter(Boolean)
      .slice(0, 12); // usually only 3–4 active

    const fetcher = async (k) => {
      const r = await fetch(
        `${API_BASE}/api/compare/xmarket/${encodeURIComponent(k)}?limit=1`
      );
      const data = r.ok ? await r.json() : {};
      const best = data?.refurb?.best;
      const rel = data?.reliable ?? null;
      return best
        ? {
            price: Number(best.price ?? null),
            url: best.url ?? null,
            savings: data?.savings ?? null,
            totalQty: data?.refurb?.total_quantity ?? 0,
            reliablePrice: rel?.price ?? null,
            reliableStock: rel?.stock_status ?? null,
            offer_id: best?.offer_id ?? best?.listing_id ?? null,
          }
        : {
            price: null,
            url: null,
            savings: null,
            totalQty: 0,
            reliablePrice: rel?.price ?? null,
            reliableStock: rel?.stock_status ?? null,
            offer_id: null,
          };
    };

    keys.forEach((k) => prewarmCompare(k, fetcher));
  }, [availableRowsBase]);

  // Sort with refurb-at-top using live refurbFlags
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

  if (error) return <div className="text-red-600 text-center py-6">{error}</div>;
  if (!model) return null;

  return (
    <div className="w-[90%] mx-auto pb-12">
      {/* Breadcrumb */}
      <div className="w-full border-b border-gray-200 mb-4">
        <nav className="text-sm text-gray-600 py-2 w-full">
          <ul className="flex space-x-2">
            <li>
              <Link to="/" className="hover:underline text-blue-600">
                Home
              </Link>
              <span className="mx-1">/</span>
            </li>
            <li className="font-semibold text-black">
              {model.brand} {model.appliance_type} {model.model_number}
            </li>
          </ul>
        </nav>
      </div>

      {/* Header section (logo + gray band) */}
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
              Known Parts: {parts.all.length} &nbsp;|&nbsp; Priced Parts:{" "}
              {parts.priced.length}
            </p>
          </div>

          {/* Exploded views strip */}
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
                  <p className="text-[10px] text-center mt-1 leading-tight truncate">
                    {view.label}
                  </p>
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
          <img
            src={popupImage}
            alt="Popup"
            className="max-h-[90vh] max-w-[90vw]"
          />
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Available Parts (75%) */}
        <div className="md:w-3/4">
          <h3 className="text-lg font-semibold mb-2">Available Parts</h3>

          {loadingParts ? (
            <p className="text-gray-500">Loading parts…</p>
          ) : availableRowsSorted.length === 0 ? (
            <p className="text-gray-500 mb-6">
              No priced parts available for this model.
            </p>
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
                  modelNumber={model.model_number}
                  // earlier trigger for badge fetch:
                  _rootMargin="700px"
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
            <div
              ref={knownRootRef}
              className="flex flex-col gap-3 max-h={[400]} max-h-[400px] overflow-y-auto pr-1"
            >
              {allKnownOrdered.map((p, idx) => (
                <AllKnownRow
                  key={`${p.mpn || idx}`}
                  row={p}
                  priced={findPriced(parts.priced, p)}
                  apiBase={API_BASE}
                  rootRef={knownRootRef}
                  modelNumber={model.model_number}
                  _rootMargin="700px"
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

function AvailCard({
  mpnKey,
  newPart,
  apiBase,
  rootRef,
  onRefurbFlag,
  modelNumber,
  _rootMargin = "700px", // NEW: earlier trigger
}) {
  const { ref: cardRef, isVisible } = useVisible({
    rootRef,
    rootMargin: _rootMargin,
  });
  const cmp = useCompareOnVisible({ key: mpnKey, visible: isVisible, apiBase });

  // report refurb availability up to parent for title/count/sort
  React.useEffect(() => {
    onRefurbFlag?.(mpnKey, !!(cmp && cmp.price != null));
  }, [cmp, mpnKey, onRefurbFlag]);

  const mpn = newPart ? extractMPN(newPart) : null;
  const title = newPart?.name || mpn || "";
  const newPrice = newPart ? numericPrice(newPart) : null;

  // refurb-only tile
  if (!newPart) {
    if (!cmp || cmp.price == null) return null;
    const refurbPrice = cmp.price;

    let refurbBanner = "No new part available";
    if (cmp.reliablePrice != null) {
      const isSpecial = String(cmp.reliableStock || "")
        .toLowerCase()
        .includes("special");
      refurbBanner = isSpecial
        ? `New part can be special ordered for ${formatPrice({
            price: cmp.reliablePrice,
          })}`
        : `New part available for ${formatPrice({ price: cmp.reliablePrice })}`;
    }

    return (
      <div ref={cardRef} className="border rounded p-3 hover:shadow transition">
        <div className="flex gap-4 items-start">
          <div className="w-20 h-20 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">
            MPN
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-gray-700 mb-0.5">
              Refurbished
            </div>
            <Link
              to={`/refurb/${encodeURIComponent(mpnKey)}`}
              state={{ fromModel: modelNumber }}
              className="line-clamp-2 font-semibold text-[15px] hover:underline"
            >
              {title || mpnKey}
            </Link>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
                In stock
              </span>
              <span className="font-semibold">{formatPrice(refurbPrice)}</span>
            </div>
          </div>
        </div>

        <Link
          to={`/refurb/${encodeURIComponent(mpnKey)}`}
          state={{ fromModel: modelNumber }}
          className="mt-2 block w-full rounded bg-red-600 text-white text-xs px-2 py-1 hover:bg-red-700 text-left"
          title={refurbBanner}
        >
          {refurbBanner}
        </Link>
      </div>
    );
  }

  // new-part tile (with optional refurb banner)
  const newMpn = extractMPN(newPart);
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
            to={`/parts/${encodeURIComponent(newMpn)}`}
            state={{ fromModel: modelNumber }}
            className="line-clamp-2 font-semibold text-[15px] hover:underline"
          >
            {newPart.name || newMpn}
          </Link>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {stockBadge(newPart?.stock_status)}
            {newPrice != null ? (
              <span className="font-semibold">{formatPrice(newPrice)}</span>
            ) : null}
          </div>
        </div>
      </div>

      {cmp && cmp.price != null ? (
        <Link
          to={`/refurb/${encodeURIComponent(newMpn)}`}
          state={{ fromModel: modelNumber }}
          className="mt-2 block w-full rounded bg-red-600 text-white text-xs px-2 py-1 hover:bg-red-700 text-left"
          title={
            cmp.savings && cmp.savings.amount != null
              ? `Refurbished available for ${formatPrice(cmp.price)} (Save $${cmp.savings.amount})`
              : `Refurbished available for ${formatPrice(cmp.price)}`
          }
        >
          Refurbished available for {formatPrice(cmp.price)}
          {cmp.savings && cmp.savings.amount != null
            ? ` (Save $${cmp.savings.amount})`
            : ""}
        </Link>
      ) : null}
    </div>
  );
}

function AllKnownRow({
  row,
  priced,
  apiBase,
  rootRef,
  modelNumber,
  _rootMargin = "700px", // NEW
}) {
  const mpn = extractMPN(row);
  const key = normalize(mpn);
  const { ref: rowRef, isVisible } = useVisible({
    rootRef,
    rootMargin: _rootMargin,
  });
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
        {price != null ? (
          <span className="font-semibold">{formatPrice(price)}</span>
        ) : null}
      </div>

      {cmp && cmp.price != null ? (
        <Link
          to={`/refurb/${encodeURIComponent(mpn)}`}
          state={{ fromModel: modelNumber }}
          className="mt-2 block w-full rounded bg-red-600 text-white text-xs px-2 py-1 hover:bg-red-700 text-left"
        >
          Refurbished available for {formatPrice(cmp.price)}
        </Link>
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

