// src/ModelPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import PartImage from "./components/PartImage";

const API_BASE = import.meta.env.VITE_API_URL;

/* ---------------- helpers ---------------- */
const normalize = (s) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

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

const numericPrice = (p) => {
  const n =
    p?.price_num ??
    p?.price_numeric ??
    (typeof p?.price === "number"
      ? p.price
      : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
  return Number.isFinite(Number(n)) ? Number(n) : null;
};

const isSpecial = (raw) => /special/i.test(String(raw || ""));
const isInStock = (raw) =>
  /(^(|\s)in\s*stock(\s|$))|\bavailable\b/i.test(String(raw || ""));

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

/* ---------------- component ---------------- */
export default function ModelPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const modelNumber = searchParams.get("model") || "";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [brandLogos, setBrandLogos] = useState([]);
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);
  const [loadingParts, setLoadingParts] = useState(false);

  // compare cache
  const [compareSummaries, setCompareSummaries] = useState({});
  const compareCacheRef = useRef(new Map());

  const MAX_REFURB_ONLY_CHECK = 60;
  const MAX_CONCURRENT_COMPARE = 10;

  /* ---- logos ---- */
  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = (brandLogos || []).find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  /* ---- data fetch ---- */
  useEffect(() => {
    const fetchModel = async () => {
      try {
        const r = await fetch(
          `${API_BASE}/api/models/search?q=${encodeURIComponent(modelNumber)}`
        );
        const d = await r.json();
        setModel(d && d.model_number ? d : null);
      } catch {
        setError("Error loading model data.");
      }
    };

    const fetchParts = async () => {
      try {
        setLoadingParts(true);
        const r = await fetch(
          `${API_BASE}/api/parts/for-model/${encodeURIComponent(modelNumber)}`
        );
        if (!r.ok) throw new Error("parts fetch failed");
        const d = await r.json();
        setParts({
          all: Array.isArray(d.all) ? d.all : [],
          priced: Array.isArray(d.priced) ? d.priced : [],
        });
      } catch {
        // silent
      } finally {
        setLoadingParts(false);
      }
    };

    const fetchBrandLogos = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/brand-logos`);
        const d = await r.json();
        setBrandLogos(Array.isArray(d) ? d : d?.logos || []);
      } catch {
        // non-fatal
      }
    };

    if (modelNumber) {
      fetchModel();
      fetchParts();
      fetchBrandLogos();
    }

    // clear any header inputs
    const input = document.querySelector("input[type='text']");
    if (input) input.value = "";
  }, [modelNumber, location]);

  /* ---- indexes ---- */
  const pricedMap = useMemo(() => {
    const m = new Map();
    for (const p of parts.priced || []) {
      const key = normalize(p.mpn);
      if (key) m.set(key, p);
    }
    return m;
  }, [parts.priced]);

  /* ---- compare refurb/new summaries ---- */
  useEffect(() => {
    const pricedKeys = (parts.priced || [])
      .map((p) => normalize(p.mpn))
      .filter(Boolean);

    const unpricedCandidates = [];
    for (const ap of parts.all || []) {
      const key = normalize(ap.mpn);
      if (key && !pricedMap.has(key)) unpricedCandidates.push(key);
      if (unpricedCandidates.length >= MAX_REFURB_ONLY_CHECK) break;
    }

    const targets = Array.from(new Set([...pricedKeys, ...unpricedCandidates])).filter(Boolean);
    if (!targets.length) return;

    let canceled = false;

    const fetchOne = async (key) => {
      try {
        const url = `${API_BASE}/api/compare/xmarket/${encodeURIComponent(key)}?limit=1`;
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        const best = data?.refurb?.best;
        const rel = data?.reliable || null;
        const summary = best
          ? {
              price: best.price ?? null,
              url: best.url ?? null,
              totalQty: data?.refurb?.total_quantity ?? 0,
              savings: data?.savings ?? null,
              reliablePrice: rel?.price ?? null,
              reliableStock: rel?.stock_status ?? null,
              offer_id: best?.listing_id ?? best?.offer_id ?? null,
            }
          : {
              price: null,
              url: null,
              totalQty: 0,
              savings: null,
              reliablePrice: rel?.price ?? null,
              reliableStock: rel?.stock_status ?? null,
              offer_id: null,
            };
        compareCacheRef.current.set(key, summary);
        return { key, summary };
      } catch {
        compareCacheRef.current.set(key, null);
        return { key, summary: null };
      }
    };

    const run = async () => {
      const queue = targets.filter((k) => !compareCacheRef.current.has(k));
      const updates = {};

      if (!queue.length) {
        for (const k of targets) updates[k] = compareCacheRef.current.get(k) ?? null;
        if (!canceled && Object.keys(updates).length) {
          setCompareSummaries((prev) => ({ ...prev, ...updates }));
        }
        return;
      }

      let i = 0;
      const workers = Array.from({ length: Math.min(MAX_CONCURRENT_COMPARE, queue.length) }).map(
        async () => {
          while (i < queue.length) {
            const idx = i++;
            const k = queue[idx];
            const { key, summary } = await fetchOne(k);
            updates[key] = summary;
          }
        }
      );
      await Promise.all(workers);

      if (!canceled && Object.keys(updates).length) {
        setCompareSummaries((prev) => ({ ...prev, ...updates }));
      }
    };

    run();
    return () => {
      canceled = true;
    };
  }, [parts.priced, parts.all, pricedMap]);

  /* ---- ordering rules for Available Parts ---- */
  const availableOrdered = useMemo(() => {
    const newParts = parts.priced || [];

    const refurbPreferred = []; // new is special + refurb exists
    const both = [];            // new + refurb
    const refurbOnly = [];      // refurb exists, no new
    const newInStock = [];
    const newSpecial = [];
    const newOther = [];

    for (const p of newParts) {
      const key = normalize(p.mpn);
      if (!key) continue;
      const cmp = compareSummaries[key];
      if (cmp && cmp.price != null) {
        if (isSpecial(p?.stock_status)) {
          refurbPreferred.push({ type: "refurb_preferred", data: p, cmp });
        } else {
          both.push({ type: "both", data: p, cmp });
        }
      } else {
        if (isInStock(p?.stock_status)) newInStock.push({ type: "new", data: p, cmp: null });
        else if (isSpecial(p?.stock_status)) newSpecial.push({ type: "new", data: p, cmp: null });
        else newOther.push({ type: "new", data: p, cmp: null });
      }
    }

    const seenNew = new Set(newParts.map((p) => normalize(p.mpn)));
    for (const a of parts.all || []) {
      const key = normalize(a.mpn);
      if (!key || seenNew.has(key)) continue;
      const cmp = compareSummaries[key];
      if (cmp && cmp.price != null) {
        refurbOnly.push({ type: "refurb", data: { ...a, mpn: a.mpn }, cmp });
      }
    }

    return [...refurbPreferred, ...both, ...refurbOnly, ...newInStock, ...newSpecial, ...newOther];
  }, [parts.priced, parts.all, compareSummaries]);

  const allKnownSorted = useMemo(() => {
    const arr = [...(parts.all || [])];
    arr.sort((a, b) => {
      const aa = Number(a?.sequence ?? 1e9);
      const bb = Number(b?.sequence ?? 1e9);
      return aa - bb;
    });
    return arr;
  }, [parts.all]);

  if (error) return <div className="text-red-600 text-center py-6">{error}</div>;
  if (!model) return null;

  /* ---- routes ---- */
  const routeForPart = (mpn) => `/parts/${encodeURIComponent(mpn)}`;
  const routeForRefurb = (mpn, offerId) =>
    offerId
      ? `/parts/${encodeURIComponent(mpn)}?offer=${encodeURIComponent(offerId)}`
      : `/parts/${encodeURIComponent(mpn)}`;

  const brandLogoUrl = getBrandLogoUrl(model.brand);

  /* full-width red compare banner */
  const bottomBadge = (text) => (
    <div className="mt-2 w-full">
      <div className="w-full text-left text-[12px] font-semibold rounded px-2 py-0.5 bg-red-600 text-white">
        {text}
      </div>
    </div>
  );

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

      {/* Header strip */}
      <div className="border rounded p-2 flex items-center mb-4 gap-3 max-h-[100px] overflow-hidden">
        <div className="w-1/6 flex items-center justify-center">
          {brandLogoUrl ? (
            <img
              src={brandLogoUrl}
              alt={`${model.brand} Logo`}
              className="object-contain h-14"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
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

          {/* Exploded views */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-2">
            {model.exploded_views?.map((view, idx) => (
              <div key={idx} className="w-24 shrink-0">
                <button
                  type="button"
                  className="group w-full border rounded p-1 bg-white hover:ring-2 hover:ring-blue-500 hover:shadow transition transform hover:-translate-y-0.5"
                  onClick={() => setPopupImage(view.image_url)}
                  title={view.label}
                >
                  <img
                    src={view.image_url}
                    alt={view.label}
                    className="w-full h-14 object-contain"
                    loading="lazy"
                    decoding="async"
                    fetchpriority="low"
                    onError={(e) => (e.currentTarget.src = "/no-image.png")}
                  />
                  <p className="text-[10px] text-center mt-1 leading-tight truncate">
                    {view.label}
                  </p>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Diagram popup */}
      {popupImage && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <button
            className="absolute top-4 right-4 text-white bg-black/60 hover:bg-black rounded-full w-9 h-9 text-xl leading-none"
            onClick={() => setPopupImage(null)}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
          <img
            src={popupImage}
            alt="Diagram"
            className="max-h-[90vh] max-w-[90vw] rounded shadow-lg"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            onClick={() => setPopupImage(null)}
          />
        </div>
      )}

      {/* Two scrollers: 75% / 25% */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* AVAILABLE PARTS */}
        <div className="md:w-3/4 max-h-[400px] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-2">Available Parts</h3>

          {loadingParts ? (
            <p className="text-gray-500 mb-6">Loading…</p>
          ) : availableOrdered.length === 0 ? (
            <p className="text-gray-500 mb-6">No available parts found for this model.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {availableOrdered.map((item, idx) => {
                const { type, data, cmp } = item;
                const mpn = data?.mpn;
                const newPriceNum = numericPrice(data);
                const refurbPriceNum =
                  cmp && cmp.price != null ? Number(cmp.price) : null;

                /* NEW + REFURB (show new card + refurb banner) */
                if (type === "both") {
                  const save =
                    newPriceNum != null &&
                    refurbPriceNum != null &&
                    newPriceNum > refurbPriceNum
                      ? (newPriceNum - refurbPriceNum).toFixed(2)
                      : null;

                  return (
                    <Link
                      key={`both-${mpn}-${idx}`}
                      to={routeForPart(mpn)}
                      className="border rounded p-3 hover:shadow"
                      title={data?.name || mpn}
                    >
                      <div className="flex gap-3">
                        <PartImage
                          imageUrl={data?.image_url}
                          imageKey={data?.image_key}
                          mpn={mpn}
                          alt={data?.name || mpn}
                          className="w-20 h-20 object-contain shrink-0"
                          loading="lazy"
                          decoding="async"
                          fetchpriority="low"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-medium whitespace-normal break-words">
                            {data?.name || mpn}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            {renderStockBadge(data?.stock_status)}
                            <span className="font-semibold">
                              {formatPrice(newPriceNum)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {bottomBadge(
                        `Refurbished available for ${formatPrice(refurbPriceNum)}${
                          save ? ` (Save $${save})` : ""
                        }`
                      )}
                    </Link>
                  );
                }

                /* REFURB preferred (new is special) — link to refurb URL if present */
                if (type === "refurb_preferred") {
                  const href = cmp?.url || routeForRefurb(mpn, cmp?.offer_id);
                  return (
                    <a
                      key={`refpref-${mpn}-${idx}`}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border rounded p-3 hover:shadow block"
                      title={data?.name || mpn}
                    >
                      <div className="flex gap-3">
                        <PartImage
                          imageUrl={data?.image_url}
                          imageKey={data?.image_key}
                          mpn={mpn}
                          alt={data?.name || mpn}
                          className="w-20 h-20 object-contain shrink-0"
                          loading="lazy"
                          decoding="async"
                          fetchpriority="low"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-medium whitespace-normal break-words">
                            <span className="text-xs font-semibold text-gray-700 mr-2">
                              Refurbished
                            </span>
                            {data?.name || mpn}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-sm">
                            {renderStockBadge(null, { forceInStock: true })}
                            <span className="font-semibold">
                              {formatPrice(refurbPriceNum)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {bottomBadge(
                        `New part can be special ordered for ${formatPrice(newPriceNum)}`
                      )}
                    </a>
                  );
                }

                /* REFURB only — link to refurb URL if present */
                if (type === "refurb") {
                  const href = cmp?.url || routeForRefurb(mpn, cmp?.offer_id);
                  const specialNew = cmp && isSpecial(cmp.reliableStock || "");
                  const bottomText =
                    cmp && cmp.reliablePrice != null
                      ? specialNew
                        ? `New part can be special ordered for ${formatPrice({
                            price: cmp.reliablePrice,
                          })}`
                        : `New part available for ${formatPrice({
                            price: cmp.reliablePrice,
                          })}`
                      : "No new part available";

                  return (
                    <a
                      key={`ref-${mpn}-${idx}`}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border rounded p-3 hover:shadow block"
                      title={data?.name || mpn}
                    >
                      <div className="flex gap-3">
                        <PartImage
                          imageUrl={data?.image_url}
                          imageKey={data?.image_key}
                          mpn={mpn}
                          alt={data?.name || mpn}
                          className="w-20 h-20 object-contain shrink-0"
                          loading="lazy"
                          decoding="async"
                          fetchpriority="low"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-medium whitespace-normal break-words">
                            <span className="text-xs font-semibold text-gray-700 mr-2">
                              Refurbished
                            </span>
                            {data?.name || mpn}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-sm">
                            {renderStockBadge(null, { forceInStock: true })}
                            <span className="font-semibold">
                              {formatPrice(refurbPriceNum)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {bottomBadge(bottomText)}
                    </a>
                  );
                }

                /* NEW only */
                return (
                  <Link
                    key={`new-${mpn}-${idx}`}
                    to={routeForPart(mpn)}
                    className="border rounded p-3 hover:shadow"
                    title={data?.name || mpn}
                  >
                    <div className="flex gap-3">
                      <PartImage
                        imageUrl={data?.image_url}
                        imageKey={data?.image_key}
                        mpn={mpn}
                        alt={data?.name || mpn}
                        className="w-20 h-20 object-contain shrink-0"
                        loading="lazy"
                        decoding="async"
                        fetchpriority="low"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-medium whitespace-normal break-words">
                          {data?.name || mpn}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-sm">
                          {renderStockBadge(data?.stock_status)}
                          <span className="font-semibold">{formatPrice(data)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ALL KNOWN PARTS */}
        <div className="md:w-1/4 max-h-[400px] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-2">All Known Parts</h3>
          {loadingParts ? (
            <p className="text-gray-500">Loading…</p>
          ) : allKnownSorted.length === 0 ? (
            <p className="text-gray-500">No parts found for this model.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {allKnownSorted.map((p) => {
                const mpn = p.mpn;
                const key = normalize(mpn);
                const priced = key ? pricedMap.get(key) : null;
                const cmp = key ? compareSummaries[key] : null;

                const banner =
                  cmp && cmp.price != null ? (
                    <div className="mt-2 w-full text-left text-[12px] font-semibold rounded px-2 py-0.5 bg-red-600 text-white">
                      {`Refurbished available for ${formatPrice(cmp.price)}`}
                    </div>
                  ) : null;

                return (
                  <div key={mpn} className="border rounded p-3">
                    {/* 1) Diagram label */}
                    <div className="text-xs text-gray-600 mb-1">
                      {`Diagram #${p.sequence ?? "–"}`}
                    </div>

                    {/* 2) Title */}
                    <div className="text-sm font-medium whitespace-normal break-words">
                      {p.name || mpn}
                    </div>

                    {/* 3) Availability + price */}
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      {priced ? (
                        <>
                          {renderStockBadge(priced?.stock_status)}
                          <span className="font-semibold">{formatPrice(priced)}</span>
                        </>
                      ) : (
                        <>
                          {renderStockBadge("unavailable")}
                          <span className="text-gray-500">—</span>
                        </>
                      )}
                    </div>

                    {/* 4) Bottom banner */}
                    {banner}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
