// src/components/Header.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const MAX_MODELS = 15;
const MAX_PARTS = 5;
const MAX_REFURB = 5;

const ENABLE_PARTS_COMPARE_PREFETCH = true;

export default function Header() {
  const navigate = useNavigate();

  /* ---------------- state ---------------- */
  const [modelQuery, setModelQuery] = useState("");
  const [partQuery, setPartQuery] = useState("");

  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);

  // refurb teaser row for Models dropdown
  const [refurbTeasers, setRefurbTeasers] = useState([]);
  const [refurbTeaserCount, setRefurbTeaserCount] = useState(0);

  const [modelPartsData, setModelPartsData] = useState({});
  const [brandLogos, setBrandLogos] = useState([]);

  // loading flags
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  // dropdown visibility + placement
  const [showModelDD, setShowModelDD] = useState(false);
  const [showPartDD, setShowPartDD] = useState(false);
  const [modelDDTop, setModelDDTop] = useState(0);
  const [partDDTop, setPartDDTop] = useState(0);

  const [modelTotalCount, setModelTotalCount] = useState(null);

  // refs
  const modelInputRef = useRef(null);
  const partInputRef = useRef(null);
  const modelBoxRef = useRef(null);
  const modelDDRef = useRef(null);
  const partBoxRef = useRef(null);
  const partDDRef = useRef(null);
  const modelAbortRef = useRef(null);
  const partAbortRef = useRef(null);

  // debounce/cache guards
  const MODELS_DEBOUNCE_MS = 750;
  const modelLastQueryRef = useRef("");
  const modelCacheRef = useRef(new Map());

  // compare summaries cache
  const [compareSummaries, setCompareSummaries] = useState({});

  /* ---------------- helpers ---------------- */
  const normalize = (s) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  const getThumb = (p) => p?.image_url || p?.image || p?.thumbnail_url || null;

  const brandSet = useMemo(() => {
    const m = new Map();
    for (const b of brandLogos || []) m.set(normalize(b.name), b.name);
    return m;
  }, [brandLogos]);

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
      p?.MPN ??
      p?.mpn_raw ??
      p?.mpn_normalized ??
      p?.mpn_norm ??
      p?.mpn_full_norm ??
      p?.mpn_coalesced ??
      p?.mpn_coalesced_norm ??
      p?.mpn_coalesced_normalized ??
      p?.listing_mpn ??
      p?.part_number ??
      p?.partNumber ??
      null;

    if (!mpn && p?.reliable_sku) {
      mpn = String(p.reliable_sku).replace(/^[A-Z]{2,}\s+/, "");
    }

    const s = (mpn ?? "").toString().trim();

    // Guard: never treat an eBay/listing id as an MPN
    if (
      /^\d{10,}$/.test(s) ||
      s === String(p?.offer_id || "") ||
      s === String(p?.listing_id || "") ||
      s === String(p?.ebay_id || "") ||
      s === String(p?.id || "")
    ) {
      return "";
    }

    return s;
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
        : Number(String(p?.price || "").replace(/[^a-z0-9.]/gi, "")));
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

  // Canonical refurb URL builder
  const routeForRefurb = (p) => {
    let mpn = extractMPN(p);

    const cand = [
      p?.mpn_display,
      p?.mpn_coalesced,
      p?.mpn_coalesced_norm,
      p?.mpn_coalesced_normalized,
      p?.mpn_normalized,
      p?.mpn_norm,
      p?.listing_mpn,
      p?.part_number,
      p?.partNumber,
    ]
      .map((x) => (x ?? "").toString().trim())
      .filter(Boolean);

    if (!mpn && typeof p?.title === "string") {
      const m = p.title.match(/\b[A-Z0-9][A-Z0-9\-_/\.]{2,}\b/);
      if (m) cand.unshift(m[0]);
    }

    if (!mpn) {
      mpn =
        cand.find(
          (s) =>
            !/^\d{10,}$/.test(s) &&
            s !== String(p?.offer_id || "") &&
            s !== String(p?.listing_id || "") &&
            s !== String(p?.ebay_id || "") &&
            s !== String(p?.id || "")
        ) || "";
    }

    if (!mpn) return "/page-not-found";

    const offerId =
      p?.offer_id ?? p?.listing_id ?? p?.ebay_id ?? p?.item_id ?? p?.id ?? null;

    const qs = offerId ? `?offer=${encodeURIComponent(String(offerId))}` : "";
    return `/refurb/${encodeURIComponent(mpn)}${qs}`;
  };

  /* ---------------- measure dropdown tops ---------------- */
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
      params.set("brand", brand);
      if (prefix) params.set("q", prefix);
    } else {
      params.set("q", q);
    }
    return `${API_BASE}/api/suggest?${params.toString()}`;
  };

  /* ---------------- fetch MODELS (debounced, cached, stale-safe) ---------------- */
  useEffect(() => {
    const q = modelQuery?.trim();
    if (!q || q.length < 2) {
      setModelSuggestions([]);
      setModelPartsData({});
      setRefurbTeasers([]);
      setRefurbTeaserCount(0);
      setShowModelDD(false);
      modelAbortRef.current?.abort?.();
      setModelTotalCount(null);
      return;
    }

    modelAbortRef.current?.abort?.();
    const controller = new AbortController();
    modelAbortRef.current = controller;

    modelLastQueryRef.current = q;

    const timer = setTimeout(async () => {
      setLoadingModels(true);
      try {
        const guess = parseBrandPrefix(q);
        const primaryUrl = buildSuggestUrl({ ...guess, q });
        const fallbackUrl = buildSuggestUrl({ brand: null, q });

        const fromCache = (url) => modelCacheRef.current.get(url) || null;
        const toCache = (url, data, headers) =>
          modelCacheRef.current.set(url, { data, headers, ts: Date.now() });

        let resData, resHeaders;
        const cachedPrimary = fromCache(primaryUrl);
        if (cachedPrimary) {
          resData = cachedPrimary.data;
          resHeaders = cachedPrimary.headers;
        } else {
          const res = await axios.get(primaryUrl, { signal: controller.signal });
          resData = res.data;
          resHeaders = res.headers;
          toCache(primaryUrl, resData, resHeaders);
        }

        let withP = resData?.with_priced_parts || [];
        let noP = resData?.without_priced_parts || [];
        let models = [...withP, ...noP];
        let total = extractServerTotal(resData, resHeaders);

        if ((models.length === 0 || total === 0 || total == null) && guess.brand) {
          const cachedFallback = fromCache(fallbackUrl);
          if (cachedFallback) {
            resData = cachedFallback.data;
            resHeaders = cachedFallback.headers;
          } else {
            const res2 = await axios.get(fallbackUrl, { signal: controller.signal });
            resData = res2.data;
            resHeaders = res2.headers;
            toCache(fallbackUrl, resData, resHeaders);
          }
          withP = resData?.with_priced_parts || [];
          noP = resData?.without_priced_parts || [];
          models = [...withP, ...noP];
          total = extractServerTotal(resData, resHeaders);
        }

        if (modelLastQueryRef.current !== q) return;

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

        // Refurb teasers by typed model text (ordered by most expensive)
        try {
          const r = await axios.get(
            `${API_BASE}/api/suggest/refurb/search?model=${encodeURIComponent(
              q
            )}&limit=12&order=price_desc`,
            { signal: controller.signal }
          );
          const items = Array.isArray(r.data?.results)
            ? r.data.results
            : parseArrayish(r.data);
          const count =
            typeof r.data?.count === "number" ? r.data.count : items.length;
          setRefurbTeasers(items.slice(0, 3));
          setRefurbTeaserCount(count);
        } catch {
          setRefurbTeasers([]);
          setRefurbTeaserCount(0);
        }
      } catch (err) {
        if (err?.name !== "CanceledError") console.error(err);
        if (modelLastQueryRef.current !== q) return;
        setModelSuggestions([]);
        setModelPartsData({});
        setRefurbTeasers([]);
        setRefurbTeaserCount(0);
        setModelTotalCount(null);
        setShowModelDD(true);
        measureAndSetTop(modelInputRef, setModelDDTop);
      } finally {
        if (modelLastQueryRef.current === q) setLoadingModels(false);
      }
    }, MODELS_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
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

    partAbortRef.current?.abort?.();
    const controller = new AbortController();
    partAbortRef.current = controller;

    const t = setTimeout(async () => {
      setLoadingParts(true);
      setLoadingRefurb(true);

      try {
        const params = { signal: controller.signal };
        const reqParts = axios.get(
          `${API_BASE}/api/suggest/parts?q=${encodeURIComponent(
            q
          )}&limit=10&full=true`,
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
    }, 500);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [partQuery]);

  /* ---------------- derived lists ---------------- */
  const visibleParts = partSuggestions.filter((p) => {
    const n = numericPrice(p);
    const stock = (p?.stock_status || "").toLowerCase();
    const discontinued = /(discontinued|nla|no\s+longer\s+available|reference)/i.test(
      stock
    );
    return !(n == null || n <= 0) || !discontinued;
  });

  const visibleRefurb = refurbSuggestions.filter((p) => {
    const qty = Number(p?.quantity_available ?? p?.quantity ?? 1);
    const stock = (p?.stock_status || p?.availability || "").toLowerCase();
    const outish = /(out\s*of\s*stock|ended|unavailable|sold\s*out)/i.test(stock);
    return !(outish && qty <= 0);
  });

  /* ---------------- compare prefetch ---------------- */
  useEffect(() => {
    if (!ENABLE_PARTS_COMPARE_PREFETCH || !showPartDD) return;
    const keys = new Set();
    for (const p of visibleParts) {
      const k = normalize(extractMPN(p));
      if (k) keys.add(k);
    }
    for (const p of visibleRefurb) {
      const k = normalize(extractMPN(p));
      if (k) keys.add(k);
    }
    const pending = [...keys].filter((k) => !(k in compareSummaries));
    if (pending.length === 0) return;

    axios
      .post(`${API_BASE}/api/compare/xmarket/bulk`, { keys: pending })
      .then((r) => {
        const items = r?.data?.items || {};
        if (items && typeof items === "object") {
          setCompareSummaries((prev) => ({ ...prev, ...items }));
        }
      })
      .catch(() => {});
  }, [showPartDD, visibleParts, visibleRefurb, compareSummaries, normalize, extractMPN]);

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
        {/* Logo */}
        <div className="col-span-4 md:col-span-3 lg:col-span-2 row-span-2 self-stretch flex items-center">
          <Link to="/" className="block h-full flex items-center">
            <img
              src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/output-onlinepngtools-3.webp"
              alt="Logo"
              className="h-12 md:h-[72px] lg:h-[84px] object-contain"
            />
          </Link>
        </div>

        {/* Menu */}
        <div className="col-span-8 md:col-span-9 lg:col-span-10 flex items-center justify-center">
          <HeaderMenu />
        </div>

        {/* Two inputs */}
        <div className="col-span-12 md:col-span-9 lg:col-span-10 md:col-start-4 lg:col-start-3">
          <div className="flex flex-wrap justify-center gap-4">
            {/* MODELS search */}
            <div ref={modelBoxRef}>
              <div className="relative">
                <input
                  ref={modelInputRef}
                  type="text"
                  placeholder="Search for your part by model number"
                  className="w-[420px] max-w-[92vw] border-4 border-yellow-400 pr-9 pl-9 px-3 py-2 rounded text-black text-sm md:text-base font-medium"
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
                {loadingModels && modelQuery.trim().length >= 2 && (
                  <svg
                    className="animate-spin h-5 w-5 text-gray-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
                    viewBox="0 0 24 24"
                    role="status"
                    aria-label="Searching"
                  >
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" className="opacity-20" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" className="opacity-90" />
                  </svg>
                )}
              </div>

              {showModelDD && (
                <div
                  ref={modelDDRef}
                  className="fixed left-1/2 -translate-x-1/2 w-[min(96vw,1100px)] bg-white text-black border rounded shadow-xl z-20 ring-1 ring-black/5"
                  style={{ top: modelDDTop }}
                >
                  <div className="p-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded inline-block">
                        Models
                      </div>
                      <div className="text-xs text-gray-600">
                        {`Showing ${renderedModelsCount} of ${totalText} Models`}
                      </div>
                    </div>

                    {/* BODY */}
                    {(refurbTeasers.length > 0 || modelSuggestions.length > 0) ? (
                      <div className="mt-2 max-h-[300px] overflow-y-auto overscroll-contain pr-1">
                        {/* Refurb teasers row (no banner text) */}
                        {refurbTeasers.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-[11px] text-gray-700">
                                {/* count on right per your spec */}
                                {refurbTeaserCount} refurbished parts found
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {refurbTeasers.map((p, i) => {
                                const mpn = extractMPN(p);
                                const title = makePartTitle(p, mpn);
                                const priceText = formatPrice(p);

                                // line 1: model they typed (uppercased)
                                const typedModel = (modelQuery || "").trim().toUpperCase();

                                // line 2: Brand • Part type • Appliance type
                                const line2 = [
                                  p?.brand || "Unbranded",
                                  p?.part_type || "Part",
                                  p?.appliance_type || "",
                                ]
                                  .filter(Boolean)
                                  .join(" • ");

                                return (
                                  <Link
                                    key={`rt-${i}-${mpn || i}`}
                                    to={routeForRefurb(p)}
                                    className="rounded-lg border border-gray-200 p-3 bg-gray-100 hover:bg-gray-200 transition"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setModelQuery("");
                                      setShowModelDD(false);
                                    }}
                                    title={title}
                                  >
                                    <div className="flex items-start gap-2">
                                      {getThumb(p) ? (
                                        <img
                                          src={getThumb(p)}
                                          alt={title}
                                          className="w-10 h-10 object-contain rounded border border-gray-200 bg-white"
                                          loading="lazy"
                                          onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                          }}
                                        />
                                      ) : (
                                        <div className="w-10 h-10 rounded border border-gray-200 bg-white flex items-center justify-center text-[10px] text-gray-500">
                                          IMG
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[10px] uppercase tracking-wide text-gray-600 mb-0.5">
                                          Refurbished part
                                        </div>
                                        <div className="font-semibold truncate">
                                          {typedModel || "MODEL"}
                                        </div>
                                        <div className="text-xs text-gray-700 truncate">
                                          {line2}
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-sm">
                                          <span className="font-semibold">{priceText}</span>
                                          {renderStockBadge(p?.stock_status, { forceInStock: true })}
                                        </div>
                                      </div>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                            <div className="mt-2 border-t" />
                          </div>
                        )}

                        {/* Model cards */}
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
                              <div
                                key={`m-${i}`}
                                className="rounded-lg border p-3 hover:bg-gray-50 transition"
                              >
                                <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto_auto] gap-x-3 gap-y-1">
                                  <div className="col-start-1 row-start-1 font-medium truncate">
                                    {m.brand} • <span className="text-gray-600">Model:</span>{" "}
                                    {m.model_number}
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
                              </div>
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
              <div className="relative">
                <input
                  ref={partInputRef}
                  type="text"
                  placeholder="Search parts / MPN"
                  className="w/[420px] max-w-[92vw] border-4 border-yellow-400 px-3 py-2 pr-9 rounded text-black text-sm md:text-base font-medium"
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
                {(loadingParts || loadingRefurb) && partQuery.trim().length >= 2 && (
                  <svg
                    className="animate-spin h-5 w-5 text-gray-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                    viewBox="0 0 24 24"
                    role="status"
                    aria-label="Searching"
                  >
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" className="opacity-20" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" className="opacity-90" />
                  </svg>
                )}
              </div>

              {showPartDD && (
                <div
                  ref={partDDRef}
                  className="fixed left-1/2 -translate-x-1/2 w-[min(96vw,1100px)] bg-white text-black border rounded shadow-xl z-20 ring-1 ring-black/5"
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
                      {/* Replacement Parts */}
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
                              const title = makePartTitle(p, mpn);
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
                                    title={title}
                                  >
                                    <div className="flex items-start gap-2">
                                      {thumb && (
                                        <img
                                          src={thumb}
                                          alt={title}
                                          className="w-10 h-10 object-contain rounded border border-gray-200 bg-white"
                                          loading="lazy"
                                          onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                          }}
                                        />
                                      )}

                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium truncate flex items-center">
                                          <span className="truncate">{title}</span>
                                          {(() => {
                                            const key = normalize(mpn || "");
                                            const cmp = key ? compareSummaries[key] : null;
                                            const refurbBest = cmp?.refurb?.price;
                                            const newBest = cmp?.reliable?.price;
                                            if (
                                              refurbBest != null &&
                                              newBest != null &&
                                              refurbBest < newBest
                                            ) {
                                              const diff = newBest - refurbBest;
                                              const pct = newBest
                                                ? Math.round((diff / newBest) * 100)
                                                : null;
                                              return (
                                                <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-emerald-600 text-white whitespace-nowrap">
                                                  Save {formatPrice(diff)}
                                                  {pct != null ? ` (${pct}%)` : ""}
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>

                                        <div className="text-xs text-gray-600 truncate">
                                          {mpn}
                                        </div>

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
                              const title = makePartTitle(p, mpn);

                              const nPrice = numericPrice(p);
                              const hasPrice = nPrice != null && nPrice > 0;
                              const priceText = hasPrice ? formatPrice(p) : null;

                              return (
                                <li key={`r-${i}-${mpn}`} className="px-0 py-0">
                                  <Link
                                    to={routeForRefurb(p)}
                                    className="block px-2 py-2 text-sm rounded bg-gray-50 hover:bg-gray-100"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setPartQuery("");
                                      setShowPartDD(false);
                                    }}
                                    title={title}
                                  >
                                    <div className="flex items-start gap-2">
                                      {thumb && (
                                        <img
                                          src={thumb}
                                          alt={title}
                                          className="w-10 h-10 object-contain rounded border border-gray-200 bg-white"
                                          loading="lazy"
                                          onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                          }}
                                        />
                                      )}

                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium truncate">
                                          {title}
                                        </div>

                                        <div className="text-xs text-gray-600 truncate">
                                          {mpn}
                                        </div>

                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                                          {priceText && (
                                            <span className="font-semibold">
                                              {priceText}
                                            </span>
                                          )}
                                          {renderStockBadge(p?.stock_status, {
                                            forceInStock: true,
                                          })}
                                        </div>

                                        {(() => {
                                          const key = normalize(mpn || "");
                                          const cmp = key ? compareSummaries[key] : null;
                                          const newBest = cmp?.reliable?.price;
                                          const stock = cmp?.reliable?.stock_status;
                                          if (newBest != null) {
                                            return (
                                              <div className="mt-1 flex items-center gap-2 text-xs">
                                                <span className="opacity-70">New:</span>
                                                <span className="font-semibold">
                                                  {formatPrice(newBest)}
                                                </span>
                                                {renderStockBadge(stock)}
                                              </div>
                                            );
                                          }
                                          return null;
                                        })()}
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
