// src/ModelPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import PartImage from "./components/PartImage";

// hooks you added
import useVisible from "./hooks/useVisible";
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

// Stock badge styling per project rules
const stockBadge = (raw) => {
  const s = String(raw || "").toLowerCase();

  if (/special/.test(s)) {
    // Special order = BLUE
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
  // Default to Unavailable
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

  // scroller roots
  const availRootRef = useRef(null);
  const knownRootRef = useRef(null);

  useEffect(() => {
    const fetchModel = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/models/search?q=${encodeURIComponent(modelNumber)}`);
        const data = await res.json();
        if (!data || !data.model_number) {
          setModel(null);
        } else {
          setModel(data);
        }
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

    // clear any lingering header dropdown input content on route change
    const input = document.querySelector("input[type='text']");
    if (input) input.value = "";
  }, [modelNumber, location]);

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  // Available list = PRICED new parts only (no blank tiles)
  const availableRows = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const p of parts.priced || []) {
      const mpn = extractMPN(p);
      const key = normalize(mpn);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, part: p });
    }
    return out;
  }, [parts.priced]);

  // All known parts ordered by diagram sequence
  const allKnownOrdered = useMemo(() => {
    const list = Array.isArray(parts.all) ? [...parts.all] : [];
    list.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    return list;
  }, [parts.all]);

  if (error) {
    return <div className="text-red-600 text-center py-6">{error}</div>;
  }
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

      {/* Header section */}
      <div className="border rounded p-2 flex items-center mb-4 gap-3 max-h-[100px] overflow-hidden">
        {/* Logo */}
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

        {/* Right  */}
        <div className="w-5/6 bg-gray-500/30 rounded p-2 flex items-center gap-3 overflow-hidden">
          <div className="w-1/3 leading-tight">
            <h2 className="text-sm font-semibold truncate">
              {model.brand} - {model.model_number} - {model.appliance_type}
            </h2>
            <p className="text-[11px] mt-1 text-gray-700">
              Known Parts: {parts.all.length} &nbsp;|&nbsp; Priced Parts: {parts.priced.length}
            </p>
          </div>

          {/* Exploded views */}
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
          <img src={popupImage} alt="Popup" className="max-h-[90vh] max-w-[90vw]" />
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Available Parts (75%) */}
        <div className="md:w-3/4">
          <h3 className="text-lg font-semibold mb-2">Available Parts</h3>

          {loadingParts ? (
            <p className="text-gray-500">Loading parts…</p>
          ) : availableRows.length === 0 ? (
            <p className="text-gray-500 mb-6">No priced parts available for this model.</p>
          ) : (
            <div
              ref={availRootRef}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1"
            >
              {availableRows.map(({ key, part }) => (
                <AvailCard
                  key={key}
                  mpnKey={key}
                  newPart={part}
                  apiBase={API_BASE}
                  rootRef={availRootRef}
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
              className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1"
            >
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

function AvailCard({ mpnKey, newPart, apiBase, rootRef }) {
  const { ref: cardRef, isVisible } = useVisible({ rootRef });
  const cmp = useCompareOnVisible({ key: mpnKey, visible: isVisible, apiBase });

  if (!newPart) return null;
  const price = numericPrice(newPart);

  return (
    <div ref={cardRef} className="border rounded p-3 hover:shadow transition">
      {/* Top layout: image + content */}
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
            {price != null ? <span className="font-semibold">{formatPrice(price)}</span> : null}
          </div>
        </div>
      </div>

      {/* Compare banner full width at bottom */}
      {cmp && cmp.price != null ? (
        <a
          href={cmp.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full rounded bg-red-600 text-white text-xs px-2 py-1 hover:bg-red-700"
          onClick={(e) => {
            if (!cmp.url) e.preventDefault();
          }}
          title={
            cmp.savings && cmp.savings.amount != null
              ? `Refurbished available for ${formatPrice(cmp.price)} (Save $${cmp.savings.amount})`
              : `Refurbished available for ${formatPrice(cmp.price)}`
          }
        >
          Refurbished available for {formatPrice(cmp.price)}
          {cmp.savings && cmp.savings.amount != null ? ` (Save $${cmp.savings.amount})` : ""}
        </a>
      ) : null}
    </div>
  );
}

function AllKnownRow({ row, priced, apiBase, rootRef }) {
  const mpn = extractMPN(row);
  const key = normalize(mpn);
  const { ref: rowRef, isVisible } = useVisible({ rootRef });
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
        {/* If no priced part, show Unavailable badge explicitly */}
        {priced ? stockBadge(priced?.stock_status) : stockBadge("unavailable")}
        {price != null ? <span className="font-semibold">{formatPrice(price)}</span> : null}
      </div>

      {/* Optional compare banner (lazy) */}
      {cmp && cmp.price != null ? (
        <a
          href={cmp.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full rounded bg-red-600 text-white text-xs px-2 py-1 hover:bg-red-700"
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

/* Helpers for AllKnown to locate a priced/new counterpart */
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


