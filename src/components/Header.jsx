// src/components/Header.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";
import { makePartTitle } from "../lib/PartsTitle";  // ← NEW

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const MAX_MODELS = 15;
const MAX_PARTS = 5;
const MAX_REFURB = 5;

// (Enrichment stays off; we’re only showing suggest data in the dropdowns)
const ENABLE_MODEL_ENRICHMENT = false;
const ENABLE_PARTS_COMPARE_PREFETCH = false;

export default function Header() {
  const navigate = useNavigate();

  /* ---------------- state ---------------- */
  const [modelQuery, setModelQuery] = useState("");
  const [partQuery, setPartQuery] = useState("");

  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);

  // Extra data for models (from suggest payload only)
  const [modelPartsData, setModelPartsData] = useState({});

  // Brand logos
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

  // Result count hint (server-provided total only)
  const [modelTotalCount, setModelTotalCount] = useState(null);

  // Refs for inputs + outside-click
  const modelInputRef = useRef(null);
  const partInputRef = useRef(null);

  const modelBoxRef = useRef(null);
  const modelDDRef = useRef(null);
  const partBoxRef = useRef(null);
  const partDDRef = useRef(null);

  // Abort controllers
  const modelAbortRef = useRef(null);
  const partAbortRef = useRef(null);

  // Compatibility stubs (no enrichment writes)
  const [modelRefurbInfo] = useState({});
  const [compareSummaries] = useState({});

  /* ---------------- helpers ---------------- */
  const normalize = (s) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  // small thumbnail for card
  const getThumb = (p) => p?.image_url || p?.image || p?.thumbnail_url || null;

  // Build quick brand set from logos (used to detect "bosch xxx")
  const brandSet = useMemo(() => {
    const m = new Map();
    for (const b of brandLogos || []) m.set(normalize(b.name), b.name);
    return m;
  }, [brandLogos]);

  // Parse modelQuery into { brand, prefix }
  const parseBrandPrefix = (q) => {
    const nq = normalize(q);
    if (!nq) return { brand: null, prefix: null };
    if (brandSet.has(nq)) return { brand: brandSet.get(nq), prefix: "" };
    const firstToken = nq.split(/\s+/)[0];
    if (brandSet.has(firstToken)) {
      const brand = brandSet.get(firstToken);
      const after = nq.slice(firstToken.length).trim();
      return { brand, prefix: after || "" };
    }
    return { brand: null, prefix: null };
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

  const isTrulyUnavailableNew = (p) => {
    const n = numericPrice(p);
    const stock = (p?.stock_status || "").toLowerCase();
    const discontinued = /(discontinued|nla|no\s+longer\s+available|reference)/i.test(
      stock
    );
    return (n == null || n <= 0) && discontinued;
  };

  const isTrulyUnavailableRefurb = (p) => {
    const n = numericPrice(p);
    const qty = Number(p?.quantity_available ?? p?.quantity ?? 0);
    const stock = (p?.stock_status || "").toLowerCase();
    const outish = /(out\s*of\s*stock|ended|unavailable)/i.test(stock);
    return (n == null || n <= 0) && (qty <= 0 || outish);
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

  // FIX: refurb suggestions should link to /refurb/<mpn> (preserve ?offer= when present)
  const routeForRefurb = (p) => {
    const mpn = extractMPN(p);
    const offerId =
      p?.offer_id ?? p?.ebay_id ?? p?.listing_id ?? p?.id ?? null;
    if (!mpn) return "/page-not-found";
    return offerId
      ? `/refurb/${encodeURIComponent(mpn)}?offer=${encodeURIComponent(offerId)}`
      : `/refurb/${encodeURIComponent(mpn)}`;
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

  /* -------- totals: extract from multiple fields/headers (no array fallback) -------- */
  const extractServerTotal = (data, headers) => {
    const candidates = [
      data?.total_models,
      data?.total_count,
      data?.meta?.total_matches,
      data?.meta?.total,
      data?.total,
      data?.count,
    ];
    const fromBody = candidates.find((x) => typeof x === "number");
    if (typeof fromBody === "number") return fromBody;

    const h =
      headers?.["x-total-count"] ||
      headers?.["x-total"] ||
      headers?.["x-total-results"];
    const n = Number(h);
    return Number.isFinite(n) ? n : null;
  };

  const buildSuggestUrl = ({ brand, prefix, q }) => {
    const params = new URLSearchParams();
    params.set("limit", String(MAX_MODELS));
    if (brand) {
      // Try brand-param path first
      params.set("brand", brand);
      if (prefix) params.set("q", prefix);
    } else {
      params.set("q", q);
    }
    return `${API_BASE}/api/suggest?${params.toString()}`;
  };

  /* ---------------- fetch MODELS (debounced, with safe fallback) ---------------- */
  useEffect(() => {
    const q = modelQuery?.trim();
    if (!q || q.length < 2) {
      setModelSuggestions([]);
      setModelPartsData({});
      setShowModelDD(false);
      modelAbortRef.current?.abort?.();
      setModelTotalCount(null);
      return;
    }

    // cancel any in-flight request
    modelAbortRef.current?.abort?.();
    const controller = new AbortController();
    modelAbortRef.current = controller;

    const t = setTimeout(async () => {
      setLoadingModels(true);
      try {
        const guess = parseBrandPrefix(q);

        // 1) Try brand-param path (if we detected a brand)
        let res = await axios.get(buildSuggestUrl({ ...guess, q }), {
          signal: controller.signal,
        });
        let { data, headers } = res;

        let withP = data?.with_priced_parts || [];
        let noP = data?.without_priced_parts || [];
        let models = [...withP, ...noP];
        let total = extractServerTotal(data, headers);

        // 2) If brand path looks bad (empty models OR total is 0/missing), fall back to plain q
        if ((models.length === 0 || total === 0 || total == null) && guess.brand) {
          const res2 = await axios.get(buildSuggestUrl({ brand: null, q }), {
            signal: controller.signal,
          });
          const { data: data2, headers: headers2 } = res2;
          const withP2 = data2?.with_priced_parts || [];
          const noP2 = data2?.without_priced_parts || [];
          const models2 = [...withP2, ...noP2];
          const total2 = extractServerTotal(data2, headers2);

          data = data2;
          headers = headers2;
          models = models2;
          total = total2;
        }

        setModelTotalCount(typeof total === "number" && total >= 0 ? total : null);

        const stats = {};
        for (const m of models) {
          stats[m.model_number] = {
            total: m.total_parts ?? 0,
            priced: m.priced_parts ?? 0,
            refurb: typeof m.refurb_count === "number" ? m.refurb_count : null,
          };
        }

        setModelSuggestions(models.slice(0, MAX_MODELS));
        setModelPartsData(stats);
        setShowModelDD(true);
        measureAndSetTop(modelInputRef, setModelDDTop);
      } catch (err) {
        if (err?.name !== "CanceledError") {
          console.error(err);
        }
        setModelSuggestions([]);
        setModelPartsData({});
        setModelTotalCount(null);
        setShowModelDD(true);
        measureAndSetTop(modelInputRef, setModelDDTop);
      } finally {
        setLoadingModels(false);
      }
    }, 500); // debounce 500ms

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [modelQuery, brandSet]);

  /* ---------------- fetch PARTS + REFURB (debounced) ---------------- */
  useEffect(() => {
    const q = partQuery?.trim();
    if (!q || q.length < 2) {
      setPartSuggestions([]);
      setRefurbSuggestions([]);
      setShowPartDD(false);
      partAbortRef.current?.abort?.();
      return;
    }

    // cancel any in-flight request
    partAbortRef.current?.abort?.();
    const controller = new AbortController();
    partAbortRef.current = controller;

    const t = setTimeout(async () => {
      setLoadingParts(true);
      setLoadingRefurb(true);

      try {
        const params = { signal: controller.signal };
        const reqParts = axios.get(
          `${API_BASE}/api/suggest/parts?q=${encodeURIComponent(q)}&limit=10`,
          params
        );
        const reqRefurb = axios.get(
          `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(q)}&limit=10`,
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
      } catch (err) {
        if (err?.name !== "CanceledError") {
          console.error(err);
        }
        setPartSuggestions([]);
        setRefurbSuggestions([]);
      } finally {
        setLoadingParts(false);
        setLoadingRefurb(false);
      }
    }, 500); // debounce 500ms

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [partQuery]);

  /* ---------------- derived: visible lists ---------------- */
  const visibleParts = partSuggestions.filter((p) => !isTrulyUnavailableNew(p));
  const visibleRefurb = refurbSuggestions.filter(
    (p) => !isTrulyUnavailableRefurb(p)
  );

  // Keep original server order (no enrichment resorting)
  const sortedModelSuggestions = useMemo(
    () => modelSuggestions.slice(0, MAX_MODELS),
    [modelSuggestions]
  );

  const renderedModelsCount = sortedModelSuggestions.length;
  const totalText = typeof modelTotalCount === "number" ? modelTotalCount : "—";

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
                    {/* Header row: title and "Showing X of Y" */}
                    <div className="flex items-center justify-between">
                      <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded inline-block">
                        Models
                      </div>
                      <div className="text-xs text-gray-600">
                        {`Showing ${renderedModelsCount} of ${totalText} Models`}
                      </div>
                    </div>

                    {loadingModels && (
                      <div className="mt-2 text-gray-600 text-sm flex items-center gap-2">
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

                    {modelSuggestions.length ? (
                      <div className="mt-2 max-h-[300px] overflow-y-auto overscroll-contain pr-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {sortedModelSuggestions.map((m, i) => {
                            const s =
                              modelPartsData[m.model_number] || {
                                total: 0,
                                priced: 0,
                                refurb: null,
                              };
                            const logo = getBrandLogoUrl(m.brand);

                            return (
                              <Link
                                key={`m-${i}`}
                                to={`/model?model=${encodeURIComponent(
                                  m.model_number
                                )}`}
                                className="rounded-lg border p-3 hover:bg-gray-50 transition"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setModelQuery("");
                                  setShowModelDD(false);
                                }}
                              >
                                {/* Top area with model+brand (left) and big logo (right) */}
                                <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto_auto] gap-x-3 gap-y-1">
                                  <div className="col-start-1 row-start-1 font-medium truncate">
                                    {m.brand} {m.model_number}
                                  </div>

                                  {logo && (
                                    <div className="col-start-2 row-start-1 row-span-2 flex items-center">
                                      <img
                                        src={logo}
                                        alt={`${m.brand} logo`}
                                        className="h-10 w-16 object-contain shrink-0"
                                        loading="lazy"
                                      />
                                    </div>
                                  )}

                                  <div className="col-start-1 row-start-2 text-xs text-gray-500 truncate">
                                    {m.appliance_type}
                                  </div>

                                  {/* Counts row (from suggest payload only) */}
                                  <div className="col-span-2 row-start-3 mt-1 text-[11px] text-gray-700 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span>Parts:</span>
                                    <span>Priced: {s.priced}</span>
                                    <span className="flex items-center gap-1">
                                      Refurbished:
                                      <span
                                        className={`px-1.5 py-0.5 rounded ${
                                          typeof s.refurb === "number" && s.refurb > 0
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-gray-100 text-gray-600"
                                        }`}
                                      >
                                        {typeof s.refurb === "number" ? s.refurb : 0}
                                      </span>
                                    </span>
                                    <span>Known: {s.total}</span>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      !loadingModels && (
                        <div className="mt-2 text-sm text-gray-500 italic">
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
                  if (e.key === "Enter" && partQuery.trim())
                    openPart(partQuery.trim());
                  if (e.key === "Escape") setShowPartDD(false);
                }}
              />

              {showPartDD && (
                <div
                  ref={partDDRef}
                  className="fixed left-1/2 -translate-x-1/2 w<[min(96vw,1100px)] bg-white text-black border rounded shadow-xl z-20 ring-1 ring-black/5"
                  style={{ top: partDDTop }}
                >
                  <div className="p-3">
                    {(loadingParts || loadingRefurb) && (
                      <div className="text-gray-600 text-sm flex items-center mb-2 gap-2">
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

                    <div className="max-h-[300px] overflow-y-auto overscroll-contain pr-1 grid grid-cols-1 md:grid-cols-2 gap-4">
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

                              const thumb = getThumb(p);
                              const brand = p?.brand || "";

                              // ↓↓↓ NEW: construct our display title
                              const displayTitle =
                                makePartTitle(p) || p?.title || p?.name || mpn;

                              const nPrice = numericPrice(p);
                              const hasPrice = nPrice != null && nPrice > 0;
                              const priceText = hasPrice ? formatPrice(p) : null;

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
                                    title={displayTitle}    {/* ← NEW */}
                                  >
                                    <div className="flex items-start gap-2">
                                      {thumb && (
                                        <img
                                          src={thumb}
                                          alt={displayTitle}  {/* ← NEW */}
                                          className="w-10 h-10 object-contain rounded border border-gray-200 bg-white"
                                          loading="lazy"
                                          onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                          }}
                                        />
                                      )}

                                      <div className="min-w-0 flex-1">
                                        {/* Line 1: brand + display title */}
                                        <div className="font-medium truncate">
                                          {brand ? `${brand} ` : ""}
                                          {displayTitle}        {/* ← NEW */}
                                        </div>

                                        {/* Line 2: MPN */}
                                        <div className="text-xs text-gray-600 truncate">
                                          {mpn}
                                        </div>

                                        {/* Line 3: price (if available) + stock */}
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                          {priceText && (
                                            <span className="font-semibold">
                                              {priceText}
                                            </span>
                                          )}
                                          {renderStockBadge(p?.stock_status)}
                                        </div>
                                      </div>
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

                              const thumb = getThumb(p);
                              const brand = p?.brand || "";

                              // ↓ Use the same constructed title; will gracefully fall back
                              const displayTitle =
                                makePartTitle(p) || p?.title || p?.name || mpn;

                              const nPrice = numericPrice(p);
                              const hasPrice = nPrice != null && nPrice > 0;
                              const priceText = hasPrice ? formatPrice(p) : null;

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
                                    title={displayTitle}    {/* ← NEW */}
                                  >
                                    <div className="flex items-start gap-2">
                                      {thumb && (
                                        <img
                                          src={thumb}
                                          alt={displayTitle}  {/* ← NEW */}
                                          className="w-10 h-10 object-contain rounded border border-gray-200 bg-white"
                                          loading="lazy"
                                          onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                          }}
                                        />
                                      )}

                                      <div className="min-w-0 flex-1">
                                        {/* Line 1: brand + display title */}
                                        <div className="font-medium truncate">
                                          {brand ? `${brand} ` : ""}
                                          {displayTitle}        {/* ← NEW */}
                                        </div>

                                        {/* Line 2: MPN */}
                                        <div className="text-xs text-gray-600 truncate">
                                          {mpn}
                                        </div>

                                        {/* Line 3: price (if available) + stock */}
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                          {priceText && (
                                            <span className="font-semibold">
                                              {priceText}
                                            </span>
                                          )}
                                          {renderStockBadge(p?.stock_status, {
                                            forceInStock: true,
                                          })}
                                        </div>
                                      </div>
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

