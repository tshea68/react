// src/components/Header.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const MAX_MODELS = 15;
const MAX_PARTS = 5;
const MAX_REFURB = 5;

export default function Header() {
  const navigate = useNavigate();

  /* ---------------- state ---------------- */
  // Inputs
  const [modelQuery, setModelQuery] = useState("");
  const [partQuery, setPartQuery] = useState("");

  // Suggestions
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);

  // Extra data for models
  const [modelPartsData, setModelPartsData] = useState({});
  const [brandLogos, setBrandLogos] = useState([]);

  // Loading flags
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  // Dropdown visibility
  const [showModelDD, setShowModelDD] = useState(false);
  const [showPartDD, setShowPartDD] = useState(false);

  // Global-centered dropdown top positions
  const [modelDDTop, setModelDDTop] = useState(0);
  const [partDDTop, setPartDDTop] = useState(0);

  // Compare summaries (cache per mpn_norm)
  const [compareSummaries, setCompareSummaries] = useState({});
  const compareCacheRef = useRef(new Map());

  // Refs for inputs + outside-click
  const modelInputRef = useRef(null);
  const partInputRef = useRef(null);

  const modelBoxRef = useRef(null);
  const modelDDRef = useRef(null);
  const partBoxRef = useRef(null);
  const partDDRef = useRef(null);

  // Abort controllers (one per search box)
  const modelAbortRef = useRef(null);
  const partAbortRef = useRef(null);

  /* ---------------- helpers ---------------- */
  const normalize = (s) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  const parseArrayish = (data) => {
    if (Array.isArray(data)) return data;
    if (data?.items && Array.isArray(data.items)) return data.items;
    if (data?.parts && Array.isArray(data.parts)) return data.parts;
    if (data?.results && Array.isArray(data.results)) return data.results;
    return [];
  };

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

  // Hide truly unavailable NEW: no price and discontinued-ish
  const isTrulyUnavailableNew = (p) => {
    const n = numericPrice(p);
    const stock = (p?.stock_status || "").toLowerCase();
    const discontinued = /(discontinued|nla|no\s+longer\s+available|reference)/i.test(
      stock
    );
    return (n == null || n <= 0) && discontinued;
  };

  // Hide truly unavailable REFURB: no price and qty<=0 or “ended/out/unavailable”
  const isTrulyUnavailableRefurb = (p) => {
    const n = numericPrice(p);
    const qty = Number(p?.quantity_available ?? p?.quantity ?? 0);
    const stock = (p?.stock_status || "").toLowerCase();
    const outish = /(out\s*of\s*stock|ended|unavailable)/i.test(stock);
    return (n == null || n <= 0) && (qty <= 0 || outish);
  };

  // Stock badge renderer (colors)
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
    // Default to black badge if unclear
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
        Unavailable
      </span>
    );
  };

  const openPart = (mpn) => {
    if (!mpn) return;
    navigate(`/parts/${encodeURIComponent(mpn)}`);
    setPartQuery("");
    setShowPartDD(false);
  };

  const routeForPart = (p) => {
    const mpn = extractMPN(p);
    return mpn ? `/parts/${encodeURIComponent(mpn)}` : "/page-not-found";
  };

  const routeForRefurb = (p) => {
    const mpn = extractMPN(p);
    const offerId = p?.offer_id ?? p?.ebay_id ?? p?.listing_id ?? p?.id ?? null;
    if (!mpn) return "/page-not-found";
    return offerId
      ? `/parts/${encodeURIComponent(mpn)}?offer=${encodeURIComponent(offerId)}`
      : `/parts/${encodeURIComponent(mpn)}`;
  };

  /* ---------------- center dropdowns globally (fixed) ---------------- */
  const measureAndSetTop = (ref, setter) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setter(rect.bottom + window.scrollY + 8);
  };

  useEffect(() => {
    const onDown = (e) => {
      const inModel =
        modelBoxRef.current?.contains(e.target) ||
        modelDDRef.current?.contains(e.target);
      const inPart =
        partBoxRef.current?.contains(e.target) ||
        partDDRef.current?.contains(e.target);
      if (!inModel) setShowModelDD(false);
      if (!inPart) setShowPartDD(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onScrollOrResize = () => {
      if (showModelDD) measureAndSetTop(modelInputRef, setModelDDTop);
      if (showPartDD) measureAndSetTop(partInputRef, setPartDDTop);
    };
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showModelDD, showPartDD]);

  /* ---------------- prefetch brand logos ---------------- */
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/brand-logos`)
      .then((r) =>
        setBrandLogos(Array.isArray(r.data) ? r.data : r.data?.logos || [])
      )
      .catch(() => {});
  }, []);

  /* ---------------- fetch MODELS (debounced) ---------------- */
  useEffect(() => {
    if (!modelQuery || modelQuery.trim().length < 2) {
      setModelSuggestions([]);
      setModelPartsData({});
      setShowModelDD(false);
      modelAbortRef.current?.abort?.();
      return;
    }

    modelAbortRef.current?.abort?.();
    modelAbortRef.current = new AbortController();

    const t = setTimeout(async () => {
      setLoadingModels(true);
      try {
        const { data } = await axios.get(
          `${API_BASE}/api/suggest?q=${encodeURIComponent(modelQuery)}&limit=15`,
          { signal: modelAbortRef.current.signal }
        );
        const withP = data?.with_priced_parts || [];
        const noP = data?.without_priced_parts || [];
        const models = [...withP, ...noP];

        const stats = {};
        for (const m of models) {
          stats[m.model_number] = {
            total: m.total_parts ?? 0,
            priced: m.priced_parts ?? 0,
          };
        }
        setModelSuggestions(models.slice(0, MAX_MODELS));
        setModelPartsData(stats);
        setShowModelDD(true);
        measureAndSetTop(modelInputRef, setModelDDTop);
      } catch {
        setModelSuggestions([]);
        setModelPartsData({});
        setShowModelDD(true);
        measureAndSetTop(modelInputRef, setModelDDTop);
      } finally {
        setLoadingModels(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [modelQuery]);

  /* ---------------- fetch PARTS + REFURB (debounced) ---------------- */
  useEffect(() => {
    if (!partQuery || partQuery.trim().length < 2) {
      setPartSuggestions([]);
      setRefurbSuggestions([]);
      setShowPartDD(false);
      partAbortRef.current?.abort?.();
      return;
    }

    partAbortRef.current?.abort?.();
    partAbortRef.current = new AbortController();

    const t = setTimeout(async () => {
      setLoadingParts(true);
      setLoadingRefurb(true);

      const params = { signal: partAbortRef.current.signal };
      const reqParts = axios.get(
        `${API_BASE}/api/suggest/parts?q=${encodeURIComponent(partQuery)}&limit=10`,
        params
      );
      const reqRefurb = axios.get(
        `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(partQuery)}&limit=10`,
        params
      );

      const [pRes, rRes] = await Promise.allSettled([reqParts, reqRefurb]);

      if (pRes.status === "fulfilled") {
        const parsed = parseArrayish(pRes.value?.data);
        setPartSuggestions(parsed.slice(0, MAX_PARTS));
      } else {
        setPartSuggestions([]);
      }

      if (rRes.status === "fulfilled") {
        const parsed = parseArrayish(rRes.value?.data);
        setRefurbSuggestions(parsed.slice(0, MAX_REFURB));
      } else {
        setRefurbSuggestions([]);
      }

      setShowPartDD(true);
      measureAndSetTop(partInputRef, setPartDDTop);
      setLoadingParts(false);
      setLoadingRefurb(false);
    }, 250);

    return () => clearTimeout(t);
  }, [partQuery]);

  /* ---------------- fetch compare summaries for top items ---------------- */
  useEffect(() => {
    const topParts = (partSuggestions || []).slice(0, MAX_PARTS);
    const topRefurbs = (refurbSuggestions || []).slice(0, MAX_REFURB);
    const bundle = [...topParts, ...topRefurbs];
    if (!bundle.length) return;

    let canceled = false;
    (async () => {
      const updates = {};
      const tasks = [];

      for (const p of bundle) {
        const mpn = extractMPN(p);
        const key = normalize(mpn);
        if (!key) continue;

        if (compareCacheRef.current.has(key)) {
          updates[key] = compareCacheRef.current.get(key);
          continue;
        }

        tasks.push(
          axios
            .get(`${API_BASE}/api/compare/xmarket/${encodeURIComponent(mpn)}?limit=1`, {
              timeout: 6000,
            })
            .then(({ data }) => {
              const best = data?.refurb?.best;
              const rel = data?.reliable || null;
              const summary = best
                ? {
                    price: best.price ?? null, // refurb best price
                    url: best.url ?? null,
                    totalQty: data?.refurb?.total_quantity ?? 0,
                    savings: data?.savings ?? null, // {amount, percent} or null
                    reliablePrice: rel?.price ?? null,
                    reliableStock: rel?.stock_status ?? null,
                  }
                : {
                    price: null,
                    url: null,
                    totalQty: 0,
                    savings: null,
                    reliablePrice: rel?.price ?? null,
                    reliableStock: rel?.stock_status ?? null,
                  };

              compareCacheRef.current.set(key, summary);
              updates[key] = summary;
            })
            .catch(() => {
              compareCacheRef.current.set(key, null);
              updates[key] = null;
            })
        );
      }

      if (tasks.length) await Promise.all(tasks);
      if (!canceled && Object.keys(updates).length) {
        setCompareSummaries((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      canceled = true;
    };
  }, [partSuggestions, refurbSuggestions]);

  /* ---------------- derived: visible lists ---------------- */
  const visibleParts = partSuggestions.filter((p) => !isTrulyUnavailableNew(p));
  const visibleRefurb = refurbSuggestions.filter((p) => !isTrulyUnavailableRefurb(p));

  /* ---------------- render ---------------- */
  return (
    <header className="sticky top-0 z-50 bg-[#001F3F] text-white shadow">
      <div className="w-full px-4 md:px-6 lg:px-10 py-3 grid grid-cols-12 gap-3">
        {/* Logo column (left) */}
        <div className="col-span-4 md:col-span-3 lg:col-span-2 row-span-2 self-stretch flex items-center">
          <Link to="/" className="block h-full flex items-center">
            <img
              src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/output-onlinepngtools-3.webp"
              alt="Logo"
              className="h-12 md:h-[72px] lg:h-[84px] object-contain"
            />
          </Link>
        </div>

        {/* Row 1: Menu */}
        <div className="col-span-8 md:col-span-9 lg:col-span-10 flex items-center justify-center">
          <HeaderMenu />
        </div>

        {/* Row 2: TWO compact inputs, centered AS A PAIR */}
        <div className="col-span-12 md:col-span-9 lg:col-span-10 md:col-start-4 lg:col-start-3">
          <div className="flex flex-wrap justify-center gap-4">
            {/* MODELS search */}
            <div ref={modelBoxRef}>
              <input
                ref={modelInputRef}
                type="text"
                placeholder="Search for your part by model number"
                className="w-[420px] max-w-[92vw] border-4 border-yellow-400 px-3 py-2 rounded text-black text-sm md:text-base font-medium"
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                onFocus={() => {
                  if (modelQuery.trim().length >= 2) {
                    setShowModelDD(true);
                    measureAndSetTop(modelInputRef, setModelDDTop);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowModelDD(false);
                }}
              />

              {showModelDD && (
                <div
                  ref={modelDDRef}
                  className="fixed left-1/2 -translate-x-1/2 w-[min(96vw,1100px)] bg-white text-black border rounded shadow-xl z-20 ring-1 ring-black/5"
                  style={{ top: modelDDTop }}
                >
                  <div className="p-3">
                    {loadingModels && (
                      <div className="text-gray-600 text-sm flex items-center mb-3 gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            fill="currentColor"
                          />
                        </svg>
                        Searching…
                      </div>
                    )}

                    <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2 inline-block">
                      Models
                    </div>

                    {modelSuggestions.length ? (
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {modelSuggestions.slice(0, MAX_MODELS).map((m, i) => {
                          const s =
                            modelPartsData[m.model_number] || { total: 0, priced: 0 };
                          const logo = getBrandLogoUrl(m.brand);
                          return (
                            <Link
                              key={`m-${i}`}
                              to={`/model?model=${encodeURIComponent(m.model_number)}`}
                              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50 transition"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setModelQuery("");
                                setShowModelDD(false);
                              }}
                            >
                              {logo && (
                                <img
                                  src={logo}
                                  alt={`${m.brand} logo`}
                                  className="h-12 w-12 object-contain shrink-0"
                                  loading="lazy"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {m.brand} {m.model_number}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {m.appliance_type}
                                </div>
                                <div className="mt-1 text-[11px] text-gray-600">
                                  <span className="mr-2">
                                    Priced Parts: {s.priced}
                                  </span>
                                  <span>Identified Parts: {s.total}</span>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      !loadingModels && (
                        <div className="text-sm text-gray-500 italic">
                          No model matches found.
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PARTS / MPN search */}
            <div ref={partBoxRef}>
              <input
                ref={partInputRef}
                type="text"
                placeholder="Search parts / MPN"
                className="w-[420px] max-w-[92vw] border-4 border-yellow-400 px-3 py-2 rounded text-black text-sm md:text-base font-medium"
                value={partQuery}
                onChange={(e) => setPartQuery(e.target.value)}
                onFocus={() => {
                  if (partQuery.trim().length >= 2) {
                    setShowPartDD(true);
                    measureAndSetTop(partInputRef, setPartDDTop);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && partQuery.trim()) openPart(partQuery.trim());
                  if (e.key === "Escape") setShowPartDD(false);
                }}
              />

              {showPartDD && (
                <div
                  ref={partDDRef}
                  className="fixed left-1/2 -translate-x-1/2 w-[min(96vw,1100px)] bg-white text-black border rounded shadow-xl z-20 ring-1 ring-black/5"
                  style={{ top: partDDTop }}
                >
                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(loadingParts || loadingRefurb) && (
                      <div className="col-span-full text-gray-600 text-sm flex items-center mb-2 gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            fill="currentColor"
                          />
                        </svg>
                        Searching…
                      </div>
                    )}

                    {/* Replacement Parts (NEW) */}
                    <div>
                      <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2 inline-block">
                        Replacement Parts
                      </div>

                      {visibleParts.length ? (
                        <ul className="divide-y">
                          {visibleParts.map((p, i) => {
                            const mpn = extractMPN(p);
                            if (!mpn) return null;
                            const brandLogo = p?.brand && getBrandLogoUrl(p.brand);

                            const key = normalize(mpn);
                            const cmp = compareSummaries[key];

                            return (
                              <li key={`p-${i}-${mpn}`} className="px-0 py-0">
                                <Link
                                  to={routeForPart(p)}
                                  className="block px-2 py-2 hover:bg-gray-100 text-sm rounded"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setPartQuery("");
                                    setShowPartDD(false);
                                  }}
                                >
                                  {/* TOP ROW: MPN — Logo — Appliance Type */}
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold truncate">{mpn}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {brandLogo && (
                                        <img
                                          src={brandLogo}
                                          alt={`${p.brand} logo`}
                                          className="h-6 w-6 md:h-7 md:w-7 object-contain"
                                        />
                                      )}
                                      {p?.appliance_type && (
                                        <span className="text-xs text-gray-500 truncate max-w-[12rem]">
                                          {p.appliance_type}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* BOTTOM ROW: Price · Stock Status · Banner */}
                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                    <span className="font-semibold">
                                      {formatPrice(p)}
                                    </span>

                                    {/* NEW: color-coded stock badge */}
                                    {renderStockBadge(p?.stock_status)}

                                    {/* Refurb banner (if present) */}
                                    {cmp && cmp.price != null && (
                                      <a
                                        href={cmp.url || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto text-[11px] rounded px-2 py-0.5 bg-emerald-50 text-emerald-700 whitespace-nowrap hover:bg-emerald-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!cmp.url) e.preventDefault();
                                        }}
                                        title={
                                          cmp.savings && cmp.savings.amount != null
                                            ? `Refurbished available for ${formatPrice(
                                                cmp.price
                                              )} (Save $${cmp.savings.amount})`
                                            : `Refurbished available for ${formatPrice(
                                                cmp.price
                                              )}`
                                        }
                                      >
                                        {`Refurbished available for ${formatPrice(cmp.price)}`}
                                        {cmp.savings && cmp.savings.amount != null
                                          ? ` (Save $${cmp.savings.amount})`
                                          : ""}
                                      </a>
                                    )}
                                  </div>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        !loadingParts && (
                          <div className="text-sm text-gray-500 italic">
                            No part matches found.
                          </div>
                        )
                      )}
                    </div>

                    {/* Refurbished Parts */}
                    <div>
                      <div className="bg-green-400 text-black font-bold text-sm px-2 py-1 rounded mb-2 inline-block">
                        Refurbished Parts
                      </div>

                      {visibleRefurb.length ? (
                        <ul className="divide-y">
                          {visibleRefurb.map((p, i) => {
                            const mpn = extractMPN(p);
                            if (!mpn) return null;
                            const key = normalize(mpn);
                            const cmp = compareSummaries[key];

                            // Banner about NEW availability
                            let refurbBanner = null;
                            if (cmp && cmp.reliablePrice != null) {
                              const refurbPrice = numericPrice(p);
                              const extra =
                                refurbPrice != null
                                  ? Math.max(
                                      0,
                                      Number(cmp.reliablePrice) - Number(refurbPrice)
                                    )
                                  : null;
                              const isSpecial = (cmp.reliableStock || "")
                                .toLowerCase()
                                .includes("special");

                              refurbBanner = (
                                <span
                                  className="ml-auto text-[11px] rounded px-2 py-0.5 bg-sky-50 text-sky-700 whitespace-nowrap"
                                  onClick={(e) => e.stopPropagation()}
                                  title={
                                    isSpecial
                                      ? `New part only special order for ${formatPrice({
                                          price: cmp.reliablePrice,
                                        })}`
                                      : `New part available for ${formatPrice({
                                          price: cmp.reliablePrice,
                                        })}`
                                  }
                                >
                                  {isSpecial
                                    ? "New part only special order for "
                                    : "New part available for "}
                                  {formatPrice({ price: cmp.reliablePrice })}
                                  {extra != null ? (
                                    <>
                                      {" ("}
                                      <span className="text-red-600">
                                        ${extra.toFixed(2)} more
                                      </span>
                                      {")"}
                                    </>
                                  ) : null}
                                </span>
                              );
                            } else {
                              refurbBanner = (
                                <span
                                  className="ml-auto text-[11px] rounded px-2 py-0.5 bg-gray-100 text-gray-700 whitespace-nowrap"
                                  onClick={(e) => e.stopPropagation()}
                                  title="No matching new part available"
                                >
                                  No new part available
                                </span>
                              );
                            }

                            return (
                              <li key={`r-${i}-${mpn}`} className="px-0 py-0">
                                <Link
                                  to={routeForRefurb(p)}
                                  className="block px-2 py-2 hover:bg-gray-100 text-sm rounded"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setPartQuery("");
                                    setShowPartDD(false);
                                  }}
                                  title={p?.title || p?.name || mpn}
                                >
                                  {/* TOP ROW: MPN — Appliance Type (logo often unknown for refurb) */}
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold truncate">{mpn}</span>
                                    {p?.appliance_type && (
                                      <span className="text-xs text-gray-500 truncate max-w-[12rem]">
                                        {p.appliance_type}
                                      </span>
                                    )}
                                  </div>

                                  {/* BOTTOM ROW: Price · Stock · Banner */}
                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                    <span className="font-semibold">{formatPrice(p)}</span>

                                    {/* REFURB = always show In stock (green) */}
                                    {renderStockBadge(p?.stock_status, {
                                      forceInStock: true,
                                    })}

                                    {refurbBanner}
                                  </div>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        !loadingRefurb && (
                          <div className="text-sm text-gray-500 italic">
                            No refurbished matches found.
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

