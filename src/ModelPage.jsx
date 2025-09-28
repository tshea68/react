// src/ModelPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import PartImage from "./components/PartImage";

// lazy-compare & visibility
import useVisible from "./hooks/useVisible";
import useCompareOnVisible from "./hooks/useCompareOnVisible";
import { getCachedCompare } from "./lib/compareClient";

const API_BASE = import.meta.env.VITE_API_URL || "";

function normalize(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}
function extractMPN(p) {
  let mpn =
    p?.mpn ??
    p?.mpn_normalized ??
    p?.MPN ??
    p?.part_number ??
    p?.partNumber ??
    p?.mpn_raw ??
    p?.listing_mpn ??
    null;
  return mpn ? String(mpn).trim() : "";
}
function numericPrice(p) {
  const n =
    p?.price_num ??
    p?.price_numeric ??
    (typeof p?.price === "number"
      ? p.price
      : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
  return Number.isFinite(Number(n)) ? Number(n) : null;
}
function formatPrice(pObjOrNumber, curr = "USD") {
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
}
function isSpecial(stockRaw) {
  return /special/i.test(String(stockRaw || ""));
}
function stockBadge(raw, { forceInStock = false } = {}) {
  if (forceInStock) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
        In stock
      </span>
    );
  }
  const s = String(raw || "").toLowerCase();
  if (/unavailable|out\s*of\s*stock|ended/i.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
        Unavailable
      </span>
    );
  }
  if (/special/i.test(s)) {
    // per latest guidance use BLUE for Special order
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">
        Special order
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
}

function routeForRefurb(mpn, offerId) {
  if (!mpn) return "#";
  return offerId
    ? `/parts/${encodeURIComponent(mpn)}?offer=${encodeURIComponent(offerId)}`
    : `/parts/${encodeURIComponent(mpn)}`;
}

const ModelPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const modelNumber = searchParams.get("model") || "";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [brandLogos, setBrandLogos] = useState([]);
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);
  const [loadingParts, setLoadingParts] = useState(false);

  // scroller roots for visibility/lazy work
  const availRootRef = useRef(null);
  const allKnownRootRef = useRef(null);

  // ───────────────────────── fetch data ─────────────────────────
  useEffect(() => {
    async function fetchModel() {
      try {
        const res = await fetch(`${API_BASE}/api/models/search?q=${encodeURIComponent(modelNumber)}`);
        const data = await res.json();
        setModel(data && data.model_number ? data : null);
      } catch (e) {
        console.error(e);
        setError("Error loading model data.");
      }
    }
    async function fetchParts() {
      try {
        setLoadingParts(true);
        const res = await fetch(`${API_BASE}/api/parts/for-model/${encodeURIComponent(modelNumber)}`);
        if (!res.ok) throw new Error("Failed to fetch parts");
        const data = await res.json();
        setParts({
          all: Array.isArray(data.all) ? data.all : [],
          priced: Array.isArray(data.priced) ? data.priced : [],
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingParts(false);
      }
    }
    async function fetchBrandLogos() {
      try {
        const res = await fetch(`${API_BASE}/api/brand-logos`);
        const data = await res.json();
        setBrandLogos(Array.isArray(data) ? data : data?.logos || []);
      } catch (e) {
        console.error(e);
      }
    }

    if (modelNumber) {
      fetchModel();
      fetchParts();
      fetchBrandLogos();
    }

    // clear any header input focus dropdowns on navigation
    const input = document.querySelector("input[type='text']");
    if (input) input.value = "";
  }, [modelNumber, location]);

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  // ─────────────── maps & candidate sets for rendering ───────────────
  const newByNorm = useMemo(() => {
    const m = new Map();
    (parts.priced || []).forEach((p) => {
      const k = normalize(extractMPN(p));
      if (k) m.set(k, p);
    });
    return m;
  }, [parts.priced]);

  // keep "All Known Parts" ordered by diagram/sequence if provided
  const allKnownOrdered = useMemo(() => {
    const arr = Array.isArray(parts.all) ? [...parts.all] : [];
    arr.sort((a, b) => (a?.sequence ?? 0) - (b?.sequence ?? 0));
    return arr;
  }, [parts.all]);

  // candidate normalized keys for AVAILABLE scroller:
  // union of priced MPNS + all-known MPNS so refurb-only can appear
  const availCandidates = useMemo(() => {
    const seen = new Set();
    const out = [];
    (parts.priced || []).forEach((p) => {
      const k = normalize(extractMPN(p));
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    });
    (allKnownOrdered || []).forEach((p) => {
      const k = normalize(extractMPN(p));
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    });
    return out;
  }, [parts.priced, allKnownOrdered]);

  // helpers for card shells
  const Title = ({ children, refurb = false }) => (
    <div className="leading-tight">
      <div className="text-[11px] text-gray-600">
        {refurb ? "Refurbished" : null}
      </div>
      <div className="text-[15px] font-semibold mt-0.5">{children}</div>
    </div>
  );

  // ─────────────────────────── render ───────────────────────────
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

      {/* Header strip (logo + meta + diagrams) */}
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

          {/* Diagrams strip */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-2">
            {model.exploded_views?.map((view, idx) => (
              <div
                key={idx}
                className="w-24 shrink-0 border rounded p-1 bg-white transition-transform duration-200 hover:scale-[1.03] hover:shadow-sm"
              >
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
            ))}
          </div>
        </div>
      </div>

      {/* Diagram popup with close button */}
      {popupImage && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="relative">
            <button
              className="absolute -top-3 -right-3 bg-white text-black rounded-full w-8 h-8 shadow"
              onClick={() => setPopupImage(null)}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
            <img src={popupImage} alt="Diagram" className="max-h-[90vh] max-w-[90vw]" />
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* AVAILABLE PARTS (75%) */}
        <div ref={availRootRef} className="md:w-3/4 max-h-[400px] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-2">Available Parts</h3>

          {loadingParts ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availCandidates.map((key, idx) => {
                const newPart = newByNorm.get(key) || null;
                const mpn = newPart ? extractMPN(newPart) : (allKnownOrdered.find(p => normalize(extractMPN(p)) === key)?.mpn || "");
                const title = newPart?.name || allKnownOrdered.find(p => normalize(extractMPN(p)) === key)?.name || mpn;

                // Observe visibility per-card in this scroller
                const { ref: cardRef, isVisible } = useVisible({ rootRef: availRootRef });
                // Lazy-compare fetch when visible
                const cmp = useCompareOnVisible({ key, visible: isVisible, apiBase: API_BASE });

                // refurb-first if cmp shows a refurb price
                if (cmp && cmp.price != null) {
                  const refurbPrice = Number(cmp.price);
                  const newPrice = newPart ? numericPrice(newPart) : null;
                  const special = isSpecial(newPart?.stock_status);

                  const bannerText = newPart
                    ? (special
                        ? `New part can be special ordered for ${formatPrice(newPrice)}`
                        : `New part available for ${formatPrice(newPrice)}${
                            newPrice && refurbPrice && newPrice > refurbPrice
                              ? ` ($${(newPrice - refurbPrice).toFixed(2)} premium)`
                              : ""
                          }`)
                    : "No new part available";

                  const href = cmp?.url || routeForRefurb(mpn, cmp?.offer_id);

                  return (
                    <a
                      key={`ref-${key}-${idx}`}
                      ref={cardRef}
                      href={href || "#"}
                      target={cmp?.url ? "_blank" : undefined}
                      rel={cmp?.url ? "noopener noreferrer" : undefined}
                      className="border rounded p-3 hover:shadow block"
                      style={{ contentVisibility: "auto", containIntrinsicSize: "160px" }}
                      title={title || mpn}
                    >
                      <div className="flex gap-3">
                        <PartImage
                          imageUrl={newPart?.image_url}
                          alt={title || mpn || "Part"}
                          className="w-20 h-20 object-contain shrink-0"
                          rootRef={availRootRef}
                        />
                        <div className="min-w-0 flex-1">
                          <Title refurb>{title || mpn}</Title>
                          <div className="mt-1 flex items-center gap-3 text-sm">
                            {stockBadge("in stock", { forceInStock: true }) /* eBay = in stock */}
                            <span className="font-semibold">{formatPrice(refurbPrice)}</span>
                          </div>
                        </div>
                      </div>

                      {/* compare/banner row (full width) */}
                      <div className="mt-2 w-full">
                        <div className="px-2 py-1 rounded bg-red-600 text-white text-[12px] text-left">
                          {bannerText}
                        </div>
                      </div>
                    </a>
                  );
                }

                // NEW-only card (no refurb or not fetched yet)
                if (newPart) {
                  const price = numericPrice(newPart);
                  return (
                    <Link
                      key={`new-${key}-${idx}`}
                      ref={cardRef}
                      to={`/parts/${encodeURIComponent(extractMPN(newPart))}`}
                      className="border rounded p-3 hover:shadow"
                      style={{ contentVisibility: "auto", containIntrinsicSize: "160px" }}
                      title={title || extractMPN(newPart)}
                    >
                      <div className="flex gap-3">
                        <PartImage
                          imageUrl={newPart?.image_url}
                          alt={title || extractMPN(newPart)}
                          className="w-20 h-20 object-contain shrink-0"
                          rootRef={availRootRef}
                        />
                        <div className="min-w-0 flex-1">
                          <Title>{title || extractMPN(newPart)}</Title>
                          <div className="mt-1 flex items-center gap-3 text-sm">
                            {stockBadge(newPart?.stock_status)}
                            <span className="font-semibold">{formatPrice(price)}</span>
                          </div>
                        </div>
                      </div>

                      {/* If a refurb appears later we’ll show banner on the refurb card instead; keep this clean */}
                    </Link>
                  );
                }

                // If we’re here, we have a candidate from all-known but no new + no refurb yet:
                // render a tiny placeholder shell to avoid layout jump.
                return (
                  <div
                    key={`placeholder-${key}-${idx}`}
                    ref={cardRef}
                    className="border rounded p-3"
                    style={{ contentVisibility: "auto", containIntrinsicSize: "160px" }}
                  >
                    <div className="h-20 w-full bg-gray-50 rounded animate-pulse" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ALL KNOWN PARTS (25%) */}
        <div ref={allKnownRootRef} className="md:w-1/4 max-h-[400px] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-2">All Known Parts</h3>

          {!allKnownOrdered.length ? (
            <p className="text-gray-500">No parts found for this model.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {allKnownOrdered.map((p, i) => {
                const mpn = extractMPN(p);
                const key = normalize(mpn);
                const priced = newByNorm.get(key) || null;
                const { ref: rowRef, isVisible } = useVisible({ rootRef: allKnownRootRef });
                const cmp = useCompareOnVisible({ key, visible: isVisible, apiBase: API_BASE });

                const price = priced ? numericPrice(priced) : null;
                const seq = p?.sequence ?? p?.diagram_number ?? null;

                // Build banner text if refurb exists
                let bannerText = null;
                if (cmp && cmp.price != null && priced) {
                  const refurbPrice = Number(cmp.price);
                  const newPrice = price;
                  const special = isSpecial(priced?.stock_status);
                  bannerText = special
                    ? `New part can be special ordered for ${formatPrice(newPrice)}`
                    : `New part available for ${formatPrice(newPrice)}${
                        newPrice && refurbPrice && newPrice > refurbPrice
                          ? ` ($${(newPrice - refurbPrice).toFixed(2)} premium)`
                          : ""
                      }`;
                }

                return (
                  <div
                    key={`all-${i}-${key}`}
                    ref={rowRef}
                    className="border rounded p-3 hover:shadow-sm"
                    style={{ contentVisibility: "auto", containIntrinsicSize: "100px" }}
                  >
                    <div className="text-xs text-gray-600 mb-1">
                      {seq != null ? `Diagram #${seq}` : "Diagram"}
                    </div>
                    <div className="text-sm font-medium truncate">
                      {p?.name || mpn}
                    </div>

                    <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                      {priced ? stockBadge(priced?.stock_status) : null}
                      {price != null ? <span className="font-semibold">{formatPrice(price)}</span> : null}
                    </div>

                    {bannerText ? (
                      <div className="mt-2 px-2 py-1 rounded bg-red-600 text-white text-[12px] text-left">
                        {bannerText}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelPage;

