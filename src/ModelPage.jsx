// src/ModelPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import PartImage from "./components/PartImage";

const API_BASE = import.meta.env.VITE_API_URL;

// -------- helpers --------
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

// -------- page --------
const ModelPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const modelNumber = searchParams.get("model") || "";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);
  const [loadingParts, setLoadingParts] = useState(false);

  // compare summaries for refurbished info per MPN (cached)
  const [compareSummaries, setCompareSummaries] = useState({});
  const compareCacheRef = useRef(new Map());

  // throttle how many "refurb-only" MPNs we'll probe to build the available list
  const MAX_REFURB_ONLY_CHECK = 60; // feel free to adjust
  const MAX_CONCURRENT_COMPARE = 10;

  useEffect(() => {
    const fetchModel = async () => {
      try {
        const t0 = performance.now();
        const res = await fetch(`${API_BASE}/api/models/search?q=${encodeURIComponent(modelNumber)}`);
        const data = await res.json();
        const t1 = performance.now();
        console.log(`🟢 /api/models/search took ${(t1 - t0).toFixed(1)} ms`);
        setModel(data && data.model_number ? data : null);
      } catch (err) {
        console.error("❌ Error loading model data:", err);
        setError("Error loading model data.");
      }
    };

    const fetchParts = async () => {
      try {
        setLoadingParts(true);
        const t0 = performance.now();
        const res = await fetch(`${API_BASE}/api/parts/for-model/${encodeURIComponent(modelNumber)}`);
        if (!res.ok) throw new Error("Failed to fetch parts");
        const data = await res.json();
        const t1 = performance.now();
        console.log(`🔵 /api/parts/for-model took ${(t1 - t0).toFixed(1)} ms`);
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

    if (modelNumber) {
      fetchModel();
      fetchParts();
    }

    // Clear stray header search dropdown if any
    const input = document.querySelector("input[type='text']");
    if (input) input.value = "";
  }, [modelNumber, location]);

  // map of priced (new) parts by normalized mpn
  const pricedMap = useMemo(() => {
    const m = new Map();
    for (const p of parts.priced || []) {
      const key = normalize(p.mpn);
      if (key) m.set(key, p);
    }
    return m;
  }, [parts.priced]);

  // we will fetch compare summaries for: all priced MPNs + first N unpriced MPNs (to discover refurb-only)
  useEffect(() => {
    const pricedKeys = (parts.priced || []).map((p) => normalize(p.mpn)).filter(Boolean);

    // unpriced mpns from "all" that are NOT in pricedMap (potential refurb-only)
    const unpricedCandidates = [];
    for (const ap of parts.all || []) {
      const key = normalize(ap.mpn);
      if (key && !pricedMap.has(key)) unpricedCandidates.push(key);
      if (unpricedCandidates.length >= MAX_REFURB_ONLY_CHECK) break;
    }

    const targets = Array.from(new Set([...pricedKeys, ...unpricedCandidates])).filter(Boolean);
    if (!targets.length) return;

    let canceled = false;

    const run = async () => {
      const updates = {};
      const queue = targets.filter((k) => !compareCacheRef.current.has(k));
      if (!queue.length) {
        // populate from cache
        for (const k of targets) updates[k] = compareCacheRef.current.get(k) ?? null;
        if (!canceled && Object.keys(updates).length) {
          setCompareSummaries((prev) => ({ ...prev, ...updates }));
        }
        return;
      }

      // small concurrency pool
      const chunk = async (key) => {
        try {
          const url = `${API_BASE}/api/compare/xmarket/${encodeURIComponent(key)}?limit=1`;
          const res = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
          const data = await res.json().catch(() => ({}));
          const best = data?.refurb?.best;
          const rel = data?.reliable || null;
          const summary = best
            ? {
                price: best.price ?? null,
                url: best.url ?? null,
                totalQty: data?.refurb?.total_quantity ?? 0,
                savings: data?.savings ?? null, // {amount, percent}
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
          updates[key] = summary;
        } catch {
          compareCacheRef.current.set(key, null);
          updates[key] = null;
        }
      };

      // simple sliding window
      let i = 0;
      const running = new Set();
      const next = async () => {
        if (i >= queue.length) return;
        const k = queue[i++];
        const p = chunk(k).finally(() => running.delete(p));
        running.add(p);
        if (running.size < MAX_CONCURRENT_COMPARE) next();
        await p;
        if (i < queue.length) await next();
      };

      // kick off up to MAX_CONCURRENT_COMPARE initial tasks
      const starters = Math.min(MAX_CONCURRENT_COMPARE, queue.length);
      const promises = [];
      for (let s = 0; s < starters; s++) promises.push(next());
      await Promise.all(promises);

      if (!canceled && Object.keys(updates).length) {
        setCompareSummaries((prev) => ({ ...prev, ...updates }));
      }
    };

    run();
    return () => {
      canceled = true;
    };
  }, [parts.priced, parts.all, pricedMap]);

  // ----- AVAILABLE PARTS ordering -----
  const availableOrdered = useMemo(() => {
    const newParts = parts.priced || [];

    const refurbOnly = [];
    const newWithRefurb = [];
    const newInStock = [];
    const newSpecial = [];
    const newOther = [];

    // helper to bucket new parts
    const stockToBucket = (raw) => {
      const s = String(raw || "").toLowerCase();
      if (/special/.test(s)) return "special";
      if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s)) return "instock";
      return "other";
    };

    // 1) new parts: check if there is a refurb option via compareSummaries
    for (const p of newParts) {
      const key = normalize(p.mpn);
      const cmp = key ? compareSummaries[key] : null;
      if (cmp && cmp.price != null) {
        newWithRefurb.push({ type: "new", data: p, cmp });
      } else {
        const bucket = stockToBucket(p?.stock_status);
        if (bucket === "instock") newInStock.push({ type: "new", data: p, cmp: null });
        else if (bucket === "special") newSpecial.push({ type: "new", data: p, cmp: null });
        else newOther.push({ type: "new", data: p, cmp: null });
      }
    }

    // 2) refurb-only: look at first N unpriced mpns in "all", include those with refurb summary
    const seenNew = new Set(newParts.map((p) => normalize(p.mpn)));
    for (const a of parts.all || []) {
      const key = normalize(a.mpn);
      if (!key || seenNew.has(key)) continue;
      const cmp = compareSummaries[key];
      if (cmp && cmp.price != null) {
        refurbOnly.push({ type: "refurb", data: { ...a, mpn: a.mpn }, cmp });
      }
    }

    // final order
    return [...refurbOnly, ...newWithRefurb, ...newInStock, ...newSpecial, ...newOther];
  }, [parts.priced, parts.all, compareSummaries]);

  // ----- ALL KNOWN PARTS, sorted by diagram number -----
  const allKnownSorted = useMemo(() => {
    const arr = [...(parts.all || [])];
    arr.sort((a, b) => {
      const aa = Number(a?.sequence ?? 1e9);
      const bb = Number(b?.sequence ?? 1e9);
      return aa - bb;
    });
    return arr;
  }, [parts.all]);

  if (error) {
    return <div className="text-red-600 text-center py-6">{error}</div>;
  }
  if (!model) return null;

  const routeForPart = (mpn) => `/parts/${encodeURIComponent(mpn)}`;
  const routeForRefurb = (mpn, offerId) =>
    offerId ? `/parts/${encodeURIComponent(mpn)}?offer=${encodeURIComponent(offerId)}` : `/parts/${encodeURIComponent(mpn)}`;

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

      {/* Header: logo + views */}
      <div className="border rounded p-2 flex items-center mb-4 gap-3 max-h-[100px] overflow-hidden">
        <div className="w-1/6 flex items-center justify-center">
          {model.brand_logo_url ? (
            <img
              src={model.brand_logo_url}
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
                <div className="border rounded p-1 bg-white">
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
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center"
          onClick={() => setPopupImage(null)}
        >
          <img src={popupImage} alt="Popup" className="max-h-[90vh] max-w-[90vw]" />
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* AVAILABLE PARTS - two columns with ordering logic */}
        <div className="md:w-1/2 max-h-[600px] overflow-y-auto">
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
                const isRefurb = type === "refurb";
                const price = isRefurb ? cmp?.price : data?.price;
                const stock = isRefurb ? "In stock" : data?.stock_status;

                return (
                  <Link
                    key={`${type}-${mpn}-${idx}`}
                    to={isRefurb ? routeForRefurb(mpn, cmp?.offer_id) : routeForPart(mpn)}
                    className="border rounded p-3 hover:shadow flex gap-3"
                    title={data?.name || mpn}
                  >
                    <PartImage
                      imageUrl={isRefurb ? (data?.image_url || "") : data?.image_url}
                      imageKey={data?.image_key}
                      mpn={mpn}
                      alt={data?.name || mpn}
                      className="w-20 h-20 object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {data?.name || mpn} {isRefurb ? <span className="ml-1 text-[11px] text-emerald-700">(Refurbished)</span> : null}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-sm">
                        <span className="font-semibold">{formatPrice(price)}</span>
                        <span>{renderStockBadge(stock, { forceInStock: isRefurb })}</span>
                      </div>

                      {/* Compare banner (for new parts show refurb alt; for refurb show new availability/price) */}
                      {cmp && !isRefurb && cmp.price != null && (
                        <a
                          href={cmp.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-[11px] rounded px-2 py-0.5 bg-emerald-50 text-emerald-700 whitespace-nowrap hover:bg-emerald-100"
                          onClick={(e) => {
                            if (!cmp.url) e.preventDefault();
                            e.stopPropagation();
                          }}
                          title={
                            cmp.savings && cmp.savings.amount != null
                              ? `Refurbished available for ${formatPrice(cmp.price)} (Save $${cmp.savings.amount})`
                              : `Refurbished available for ${formatPrice(cmp.price)}`
                          }
                        >
                          {`Refurbished available for ${formatPrice(cmp.price)}`}
                          {cmp.savings && cmp.savings.amount != null ? ` (Save $${cmp.savings.amount})` : ""}
                        </a>
                      )}

                      {cmp && isRefurb && cmp.reliablePrice != null && (
                        <span
                          className="mt-1 inline-block text-[11px] rounded px-2 py-0.5 bg-sky-50 text-sky-700 whitespace-nowrap"
                          title={`New part available for ${formatPrice({ price: cmp.reliablePrice })}`}
                        >
                          New part available for {formatPrice({ price: cmp.reliablePrice })}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ALL KNOWN PARTS - single column, sorted by diagram number */}
        <div className="md:w-1/2 max-h-[600px] overflow-y-auto">
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

                // line 3 price + availability (from priced if present)
                const priceNode = priced ? (
                  <span className="font-semibold">{formatPrice(priced)}</span>
                ) : (
                  <span className="text-gray-500">—</span>
                );

                return (
                  <div key={mpn} className="border rounded p-3">
                    {/* line 1 */}
                    <div className="text-xs text-gray-600 mb-1">
                      {`Diagram #${p.sequence ?? "–"}`}
                    </div>

                    {/* line 2 */}
                    <div className="text-sm font-medium">{p.name || mpn}</div>

                    {/* line 3 */}
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      {priceNode}
                      {priced ? renderStockBadge(priced?.stock_status) : renderStockBadge("unavailable")}
                    </div>

                    {/* line 4 compare banner */}
                    {cmp && cmp.price != null && (
                      <a
                        href={cmp.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-[11px] rounded px-2 py-0.5 bg-emerald-50 text-emerald-700 whitespace-nowrap hover:bg-emerald-100"
                        onClick={(e) => {
                          if (!cmp.url) e.preventDefault();
                          e.stopPropagation();
                        }}
                        title={
                          cmp.savings && cmp.savings.amount != null
                            ? `Refurbished available for ${formatPrice(cmp.price)} (Save $${cmp.savings.amount})`
                            : `Refurbished available for ${formatPrice(cmp.price)}`
                        }
                      >
                        {`Refurbished available for ${formatPrice(cmp.price)}`}
                        {cmp.savings && cmp.savings.amount != null ? ` (Save $${cmp.savings.amount})` : ""}
                      </a>
                    )}
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

