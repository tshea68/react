// src/components/Header.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";
import { makePartTitle } from "../lib/PartsTitle";
import CartWidget from "./CartWidget";

const API_BASE = "https://api.appliancepartgeeks.com";
const MAX_MODELS = 15;
const MAX_PARTS = 10; // show up to 10 parts (scrollable)
const MAX_REFURB = 10; // show up to N netted refurb cards

// Cloudflare Worker for Reliable availability (used for per-card inventory count)
const AVAIL_URL = "https://inventorychecker.timothyshea.workers.dev";
const DEFAULT_ZIP = "10001";

// Feature toggles
const ENABLE_MODEL_ENRICHMENT = false;
const ENABLE_PARTS_COMPARE_PREFETCH = false;

// ---- normalize incoming logo payloads from /api/brand-logos ----
const normalizeStr = (s) => (s || "").toString().trim();

const coerceLogos = (data) => {
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(data?.logos)
    ? data.logos
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return arr
    .map((row) => {
      const name =
        normalizeStr(row?.name) ||
        normalizeStr(row?.brand_long) ||
        normalizeStr(row?.brand) ||
        "";

      const image_url =
        normalizeStr(row?.image_url) ||
        normalizeStr(row?.logo_url) ||
        normalizeStr(row?.url) ||
        normalizeStr(row?.src) ||
        normalizeStr(row?.image) ||
        "";

      if (!name || !image_url) return null;
      return { name, image_url };
    })
    .filter(Boolean);
};

export default function Header() {
  const navigate = useNavigate();

  // ===== STATE =====
  const [modelQuery, setModelQuery] = useState("");
  const [partQuery, setPartQuery] = useState("");

  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);

  // Refurb: show multiple netted cards; also keep total offer count
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);
  const [refurbTotalCount, setRefurbTotalCount] = useState(0);

  const [modelPartsData, setModelPartsData] = useState({});
  const [brandLogos, setBrandLogos] = useState([]);

  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  // Per-card inventory counts for the "New Parts" dropdown cards (Reliable worker)
  const [partInvCounts, setPartInvCounts] = useState({});
  const partInvCacheRef = useRef(new Map());

  const [showModelDD, setShowModelDD] = useState(false);
  const [showPartDD, setShowPartDD] = useState(false);

  const [modelDDTop, setModelDDTop] = useState(0);
  const [partDDTop, setPartDDTop] = useState(0);

  const [modelTotalCount, setModelTotalCount] = useState(null);

  // facets
  const [facetBrands, setFacetBrands] = useState([]);
  const [facetTypes, setFacetTypes] = useState([]);
  const [loadingFacets, setLoadingFacets] = useState(false);

  // explicit "no results" flags
  const [noModelResults, setNoModelResults] = useState(false);
  const [noPartResults, setNoPartResults] = useState(false);

  // refs
  const modelInputRef = useRef(null);
  const partInputRef = useRef(null);
  const modelBoxRef = useRef(null);
  const partBoxRef = useRef(null);
  const modelDDRef = useRef(null);
  const partDDRef = useRef(null);

  const modelAbortRef = useRef(null);
  const facetsAbortRef = useRef(null);
  const partAbortRef = useRef(null);

  const modelsSeqRef = useRef(0);
  const partsSeqRef = useRef(0);

  // ===== UTILS =====

  const clean = (v) => (v == null ? "" : String(v)).trim();
  const normalize = (s) =>
    clean(s)
      .toLowerCase()
      .replace(/[\s\-_.]+/g, "")
      .replace(/[^a-z0-9]/g, "");

  const parseArrayish = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const measureAndSetTop = (inputRef, setTop) => {
    const el = inputRef?.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTop(rect.bottom + window.scrollY + 6);
  };

  const getTrustedMPN = (p) => {
    if (!p) return "";
    const mpn =
      clean(p?.mpn) ||
      clean(p?.manufacturer_part_number) ||
      clean(p?.mpn_number) ||
      clean(p?.part_number) ||
      clean(p?.partNumber) ||
      clean(p?.oem_part_number) ||
      clean(p?.sku) ||
      "";
    return mpn;
  };

  const numericPrice = (p) => {
    const raw = p?.price ?? p?.sale_price ?? p?.current_price ?? p?.amount;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const formatPrice = (p) => {
    const n = numericPrice(p);
    if (n == null) return "";
    try {
      return n.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      });
    } catch {
      return `$${n.toFixed(2)}`;
    }
  };

  const isTrulyUnavailableNew = (p) => {
    const s = clean(p?.stock_status).toLowerCase();
    return s.includes("discont") || s.includes("obsolete") || s.includes("unavail");
  };

  const isTrulyUnavailableRefurb = (p) => {
    const s = clean(p?.stock_status).toLowerCase();
    return s.includes("sold") || s.includes("unavail");
  };

  const renderStockBadge = (stockStatus, opts = {}) => {
    const forceInStock = !!opts.forceInStock;

    if (forceInStock) {
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800 border border-green-200">
          In stock
        </span>
      );
    }

    const s = clean(stockStatus).toLowerCase();
    if (!s) return null;

    if (s.includes("in stock") || s.includes("available")) {
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800 border border-green-200">
          In stock
        </span>
      );
    }
    if (s.includes("special") || s.includes("backorder")) {
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800 border border-yellow-200">
          Special order
        </span>
      );
    }
    if (s.includes("unavail") || s.includes("discont") || s.includes("obsolete")) {
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 border border-gray-200">
          Unavailable
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
        {stockStatus}
      </span>
    );
  };

  // Brand prefix parsing
  const parseBrandPrefix = (qRaw) => {
    const q = (qRaw || "").trim();
    const m = q.match(/^([a-z]{2,})\s+(.+)$/i);
    if (!m) return { brand: "", prefix: "" };
    return { brand: m[1].trim(), prefix: m[2].trim() };
  };

  const buildModelsSearchUrl = (qRaw) =>
    `${API_BASE}/api/suggest?q=${encodeURIComponent(qRaw || "")}&limit=15`;

  const buildPartsSearchUrlPrimary = (qRaw) => {
    const { brand, prefix } = parseBrandPrefix(qRaw || "");
    const params = new URLSearchParams();
    params.set("limit", "10");
    params.set("in_stock", "true");

    if (brand && prefix === "") {
      params.set("brand", brand);
      params.set("q", "");
    } else if (brand && prefix) {
      params.set("brand", brand);
      params.set("q", prefix);
    } else {
      params.set("q", qRaw || "");
    }
    return `${API_BASE}/api/suggest/parts?${params.toString()}`;
  };

  const buildPartsSearchUrlFallback = (qRaw) => {
    const params = new URLSearchParams();
    params.set("limit", "10");
    params.set("in_stock", "true");
    params.set("q", qRaw || "");
    return `${API_BASE}/api/suggest/parts?${params.toString()}`;
  };

  const APPLIANCE_WORDS = [
    "washer",
    "washing",
    "dryer",
    "dishwasher",
    "fridge",
    "refrigerator",
    "freezer",
    "range",
    "oven",
    "stove",
    "cooktop",
    "microwave",
    "hood",
    "icemaker",
    "ice maker",
  ];
  const PART_WORDS = [
    "board",
    "control",
    "pump",
    "valve",
    "motor",
    "sensor",
    "thermistor",
    "heater",
    "switch",
    "knob",
    "belt",
    "door",
    "gasket",
    "seal",
    "filter",
    "hose",
    "element",
    "igniter",
    "regulator",
    "rack",
    "shelf",
    "module",
    "relay",
    "compressor",
    "gear",
  ];
  const looksLikeApplianceOrPart = (q) => {
    const k = (q || "").toLowerCase();
    return [...APPLIANCE_WORDS, ...PART_WORDS].some((w) => k.includes(w));
  };

  const buildRefurbSearchUrl = (q) => {
    const guess = parseBrandPrefix((q || "").trim());
    if (looksLikeApplianceOrPart(q)) {
      return `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(q)}&limit=10`;
    }
    if (guess.brand && guess.prefix === "") {
      return `${API_BASE}/api/suggest/refurb/search?brand=${encodeURIComponent(
        guess.brand
      )}&q=${encodeURIComponent(q)}&limit=10&order=price_desc`;
    }
    if (guess.brand && guess.prefix) {
      return `${API_BASE}/api/suggest/refurb/search?model=${encodeURIComponent(
        q
      )}&brand=${encodeURIComponent(guess.brand)}&limit=10&order=price_desc`;
    }
    return `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(q)}&limit=10`;
  };

  // Fetch + cache inventory count from worker (same endpoint used on SingleProduct page).
  // Returns a number (totalAvailable) or null on any failure.
  const fetchInventoryCount = async (mpn, zip = DEFAULT_ZIP) => {
    const m = (mpn || "").toString().trim();
    const z = (zip || DEFAULT_ZIP).toString().trim() || DEFAULT_ZIP;
    if (!m) return null;

    const key = `${m.toUpperCase()}|${z}`;
    if (partInvCacheRef.current.has(key)) {
      return partInvCacheRef.current.get(key);
    }

    try {
      const res = await fetch(`${AVAIL_URL}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partNumber: m,
          postalCode: z,
          quantity: 1,
          distanceMeasure: "m",
        }),
      });

      if (!res.ok) {
        partInvCacheRef.current.set(key, null);
        return null;
      }

      const data = await res.json();

      const count =
        (typeof data?.totalAvailable === "number" ? data.totalAvailable : null) ??
        (typeof data?.total_available === "number" ? data.total_available : null) ??
        (typeof data?.available === "number" ? data.available : null) ??
        (typeof data?.total === "number" ? data.total : null) ??
        null;

      partInvCacheRef.current.set(key, count);
      return count;
    } catch {
      partInvCacheRef.current.set(key, null);
      return null;
    }
  };

  // Refurb title normalization so makePartTitle() works consistently
  const normalizeForTitle = (p) => {
    if (!p || typeof p !== "object") return p;

    const title =
      p?.title ||
      p?.name ||
      p?.part_name ||
      p?.part_title ||
      p?.listing_title ||
      p?.ebay_title ||
      p?.offer_title ||
      p?.headline ||
      "";

    return {
      ...p,
      title,
      name: p?.name || title,
    };
  };

  const routeForPart = (p) => {
    const mpn = getTrustedMPN(p);
    if (!mpn) return "/";
    return `/parts/${encodeURIComponent(mpn)}`;
  };

  const routeForRefurb = (p) => {
    const mpn = getTrustedMPN(p);
    if (!mpn) return "/";
    return `/refurb/${encodeURIComponent(mpn)}`;
  };

  const getThumb = (p) => {
    const u =
      clean(p?.image_url) ||
      clean(p?.image) ||
      clean(p?.thumbnail) ||
      clean(p?.thumb) ||
      "";
    return u;
  };

  // ===== FETCH: BRAND LOGOS (once) =====
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await axios.get(`${API_BASE}/api/brand-logos`);
        if (cancelled) return;
        setBrandLogos(coerceLogos(r.data));
      } catch (e) {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ===== FETCH: FACETS (models) =====
  const FACETS_DEBOUNCE_MS = 250;
  useEffect(() => {
    const q = (modelQuery || "").trim();
    if (!showModelDD || q.length < 2) {
      setFacetBrands([]);
      setFacetTypes([]);
      return;
    }

    facetsAbortRef.current?.abort?.();
    const controller = new AbortController();
    facetsAbortRef.current = controller;

    const timer = setTimeout(async () => {
      setLoadingFacets(true);
      try {
        const r = await axios.get(
          `${API_BASE}/api/models/facets?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        const brands = Array.isArray(r.data?.brands) ? r.data.brands : [];
        const types = Array.isArray(r.data?.appliance_types)
          ? r.data.appliance_types
          : [];

        setFacetBrands(brands.slice(0, 12));
        setFacetTypes(types.slice(0, 12));
      } catch (e) {
        if (e?.name !== "CanceledError") console.error(e);
      } finally {
        setLoadingFacets(false);
      }
    }, FACETS_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [modelQuery, showModelDD]);

  // ===== FETCH: MODELS (debounced) =====
  useEffect(() => {
    const q = modelQuery?.trim();

    if (!q || q.length < 2) {
      setShowModelDD(false);
      modelAbortRef.current?.abort?.();
      setModelSuggestions([]);
      setModelPartsData({});
      setNoModelResults(false);
      setModelTotalCount(null);
      return;
    }

    modelAbortRef.current?.abort?.();
    const controller = new AbortController();
    modelAbortRef.current = controller;
    const runId = ++modelsSeqRef.current;

    const tmr = setTimeout(async () => {
      setLoadingModels(true);
      setNoModelResults(false);

      try {
        const r = await axios.get(buildModelsSearchUrl(q), {
          signal: controller.signal,
        });
        if (modelsSeqRef.current !== runId) return;

        const arr = parseArrayish(r.data);
        setModelSuggestions(Array.isArray(arr) ? arr.slice(0, MAX_MODELS) : []);
        setModelTotalCount(
          typeof r.data?.total === "number"
            ? r.data.total
            : Array.isArray(arr)
            ? arr.length
            : null
        );

        setNoModelResults(!arr || arr.length === 0);
        setShowModelDD(true);
        measureAndSetTop(modelInputRef, setModelDDTop);
      } catch {
        setModelSuggestions([]);
        setModelPartsData({});
        setModelTotalCount(null);
        setNoModelResults(true);
      } finally {
        if (modelsSeqRef.current === runId) setLoadingModels(false);
      }
    }, 250);

    return () => {
      clearTimeout(tmr);
      controller.abort();
    };
  }, [modelQuery]);

  // ===== FETCH: PARTS + REFURB (debounced) =====
  const PARTS_DEBOUNCE_MS = 300;
  useEffect(() => {
    const q = (partQuery || "").trim();

    if (q.length < 2) {
      setShowPartDD(false);
      partAbortRef.current?.abort?.();
      setPartSuggestions([]);
      setRefurbSuggestions([]);
      setRefurbTotalCount(0);
      setNoPartResults(false);
      return;
    }

    partAbortRef.current?.abort?.();
    const controller = new AbortController();
    partAbortRef.current = controller;
    const runId = ++partsSeqRef.current;

    const tmr = setTimeout(async () => {
      setLoadingParts(true);
      setLoadingRefurb(true);
      setNoPartResults(false);

      try {
        const params = { signal: controller.signal };

        const [pRes, rRes] = await Promise.allSettled([
          axios.get(buildPartsSearchUrlPrimary(q), params).catch(() => null),
          axios.get(buildRefurbSearchUrl(q), params).catch(() => null),
        ]);

        if (partsSeqRef.current !== runId) return;

        let partsArr = [];
        if (pRes.status === "fulfilled" && pRes.value) {
          partsArr = parseArrayish(pRes.value.data);

          if (
            (!Array.isArray(partsArr) || partsArr.length === 0) &&
            !controller.signal.aborted
          ) {
            try {
              const r2 = await axios.get(buildPartsSearchUrlFallback(q), params);
              partsArr = parseArrayish(r2.data);
            } catch {
              // ignore
            }
          }
        }

        const refurbArr =
          rRes.status === "fulfilled" && rRes.value
            ? parseArrayish(rRes.value.data)
            : [];

        const hasParts = Array.isArray(partsArr) && partsArr.length > 0;
        const hasRefurb = Array.isArray(refurbArr) && refurbArr.length > 0;

        setPartSuggestions(hasParts ? partsArr.slice(0, MAX_PARTS) : []);

        if (hasRefurb) {
          const totalOffers = refurbArr.reduce(
            (acc, x) => acc + Number(x?.refurb_count ?? x?.refurb_offers ?? 1),
            0
          );
          setRefurbTotalCount(
            Number.isFinite(totalOffers) ? totalOffers : refurbArr.length
          );
          setRefurbSuggestions(refurbArr.slice(0, MAX_REFURB));
        } else {
          setRefurbTotalCount(0);
          setRefurbSuggestions([]);
        }

        setNoPartResults(!hasParts && !hasRefurb);

        setShowPartDD(true);
        measureAndSetTop(partInputRef, setPartDDTop);
      } catch {
        setPartSuggestions([]);
        setRefurbSuggestions([]);
        setRefurbTotalCount(0);
        setNoPartResults(true);
      } finally {
        if (partsSeqRef.current === runId) {
          setLoadingParts(false);
          setLoadingRefurb(false);
        }
      }
    }, PARTS_DEBOUNCE_MS);

    return () => {
      clearTimeout(tmr);
      controller.abort();
    };
  }, [partQuery]);

  // ===== DERIVED LISTS =====
  const visibleParts = partSuggestions.filter((p) => !isTrulyUnavailableNew(p));
  const visibleRefurb = refurbSuggestions
    .map(normalizeForTitle)
    .filter((p) => !isTrulyUnavailableRefurb(p));

  const isInStock = (p) =>
    /(in\s*stock|available)/i.test(String(p?.stock_status || ""));

  const sortPartsForDisplay = (arr) =>
    arr.slice().sort((a, b) => {
      const ai = isInStock(a) ? 0 : 1;
      const bi = isInStock(b) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      const ap = numericPrice(a);
      const bp = numericPrice(b);
      if (ap != null && bp != null) return ap - bp;
      if (ap != null) return -1;
      if (bp != null) return 1;
      return 0;
    });

  const inStockPartsOnly = visibleParts.filter(isInStock);
  const visiblePartsSorted = (inStockPartsOnly.length > 0
    ? inStockPartsOnly
    : visibleParts
  )
    .slice(0, MAX_PARTS)
    .sort((a, b) => (sortPartsForDisplay([a, b])[0] === a ? -1 : 1));

  // Fetch inventory counts for the visible New Parts cards (only) when the dropdown is open.
  useEffect(() => {
    if (!showPartDD) return;
    if (!visiblePartsSorted || visiblePartsSorted.length === 0) return;

    let cancelled = false;

    (async () => {
      const updates = {};
      const slice = visiblePartsSorted.slice(0, MAX_PARTS);

      await Promise.all(
        slice.map(async (p) => {
          const mpn = getTrustedMPN(p);
          if (!mpn) return;

          const cnt = await fetchInventoryCount(mpn, DEFAULT_ZIP);
          updates[mpn] = cnt;
        })
      );

      if (cancelled) return;
      if (Object.keys(updates).length) {
        setPartInvCounts((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPartDD, visiblePartsSorted]);

  // ===== PREFETCH (off) =====
  const [compareSummaries, setCompareSummaries] = useState({});
  useEffect(() => {
    if (!ENABLE_MODEL_ENRICHMENT) return;
    if (!ENABLE_PARTS_COMPARE_PREFETCH || !showPartDD) return;

    const keys = new Set();
    for (const p of visiblePartsSorted) {
      const k = normalize(getTrustedMPN(p));
      if (k) keys.add(k);
    }
    for (const p of visibleRefurb) {
      const k = normalize(getTrustedMPN(p));
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
  }, [showPartDD, visiblePartsSorted, visibleRefurb, compareSummaries]);

  // ===== RENDER PREP =====
  const sortedModelSuggestions = useMemo(
    () => modelSuggestions.slice(0, MAX_MODELS),
    [modelSuggestions]
  );
  const totalText =
    typeof modelTotalCount === "number" ? modelTotalCount : "—";

  const modelsHeading = useMemo(() => {
    const q = (modelQuery || "").trim();
    if (!q) return "Popular models";
    return `Popular models matching “${q}”`;
  }, [modelQuery]);

  const facetLabel = (x) => (x?.label || x?.value || "").toString();
  const facetValue = (x) => (x?.value || x?.label || "").toString();
  const facetCount = (x) => Number(x?.count ?? 0);

  const closeAll = () => {
    setShowModelDD(false);
    setShowPartDD(false);
  };

  // close dropdowns on outside click
  useEffect(() => {
    function onDown(e) {
      const t = e.target;
      const inModel =
        modelBoxRef.current && modelBoxRef.current.contains(t);
      const inPart = partBoxRef.current && partBoxRef.current.contains(t);
      const inDD =
        (modelDDRef.current && modelDDRef.current.contains(t)) ||
        (partDDRef.current && partDDRef.current.contains(t));
      if (!inModel && !inPart && !inDD) closeAll();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ===== RENDER =====
  return (
    <header className="w-full bg-[#001b36] text-white">
      <div className="mx-auto max-w-7xl px-3">
        <div className="flex items-stretch gap-3 py-3">
          {/* LEFT: logo */}
          <div className="flex items-center">
            <button
              className="text-left"
              onClick={() => navigate("/")}
              aria-label="Home"
            >
              <div className="text-xl font-extrabold leading-none">
                Appliance Part Geeks
              </div>
              <div className="text-[11px] text-white/70 -mt-0.5">
                Parts • Refurbished • Diagrams
              </div>
            </button>
          </div>

          {/* RIGHT: menu + cart */}
          <div className="flex-1 flex items-center justify-end gap-3">
            <HeaderMenu />
            <CartWidget />
          </div>
        </div>

        {/* SEARCH ROW */}
        <div className="pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* MODEL SEARCH */}
            <div className="relative" ref={modelBoxRef}>
              <label className="block text-[12px] font-semibold text-white/80 mb-1">
                Search by Model Number
              </label>
              <input
                ref={modelInputRef}
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                onFocus={() => {
                  if ((modelQuery || "").trim().length >= 2) {
                    setShowModelDD(true);
                    measureAndSetTop(modelInputRef, setModelDDTop);
                  }
                }}
                placeholder="e.g. WDT750SAKZ0"
                className="w-full rounded-md px-3 py-2 text-black"
              />

              {showModelDD && (
                <div
                  ref={modelDDRef}
                  className="absolute z-50 w-full"
                  style={{ top: modelDDTop }}
                >
                  <div className="rounded-xl border border-gray-200 bg-white text-black shadow-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{modelsHeading}</div>
                      <div className="text-[12px] text-gray-500">
                        Total: {totalText}
                      </div>
                    </div>

                    {/* facets */}
                    {(facetBrands.length > 0 || facetTypes.length > 0) && (
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <div className="text-[12px] font-semibold text-gray-700">
                            Brands
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {facetBrands.map((b, i) => (
                              <button
                                key={`fb-${i}`}
                                className="text-[12px] rounded-full border border-gray-200 px-2 py-0.5 hover:bg-gray-50"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  const v = facetValue(b);
                                  if (!v) return;
                                  setModelQuery(v);
                                }}
                              >
                                {facetLabel(b)}{" "}
                                <span className="text-gray-500">
                                  ({facetCount(b)})
                                </span>
                              </button>
                            ))}
                            {loadingFacets && (
                              <span className="text-[12px] text-gray-500">
                                Loading…
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[12px] font-semibold text-gray-700">
                            Appliance Types
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {facetTypes.map((b, i) => (
                              <button
                                key={`ft-${i}`}
                                className="text-[12px] rounded-full border border-gray-200 px-2 py-0.5 hover:bg-gray-50"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  const v = facetValue(b);
                                  if (!v) return;
                                  setModelQuery(v);
                                }}
                              >
                                {facetLabel(b)}{" "}
                                <span className="text-gray-500">
                                  ({facetCount(b)})
                                </span>
                              </button>
                            ))}
                            {loadingFacets && (
                              <span className="text-[12px] text-gray-500">
                                Loading…
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3">
                      {loadingModels && (
                        <div className="text-sm text-gray-500 italic">
                          Loading…
                        </div>
                      )}
                      {!loadingModels &&
                        sortedModelSuggestions.length === 0 &&
                        (noModelResults ? (
                          <div className="text-sm text-gray-500 italic">
                            No models found.
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">
                            Type at least 2 characters…
                          </div>
                        ))}

                      {sortedModelSuggestions.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {sortedModelSuggestions.map((m, idx) => {
                            const modelNum =
                              m?.model_number || m?.model || m?.value || "";
                            const brand = m?.brand || "";
                            const applianceType = m?.appliance_type || "";
                            const logo =
                              brandLogos.find(
                                (b) =>
                                  normalizeStr(b?.name).toLowerCase() ===
                                  normalizeStr(brand).toLowerCase()
                              )?.image_url || "";

                            return (
                              <Link
                                key={`m-${idx}-${modelNum || idx}`}
                                to={`/model/${encodeURIComponent(modelNum)}`}
                                className="block rounded border border-gray-200 p-2 hover:bg-gray-50 transition"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setModelQuery("");
                                  setShowModelDD(false);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  {logo && (
                                    <img
                                      src={logo}
                                      alt={brand || "Brand"}
                                      className="w-10 h-10 object-contain rounded border border-gray-200 bg-white"
                                      loading="lazy"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-semibold text-sm truncate">
                                      {modelNum}
                                    </div>
                                    <div className="text-[12px] text-gray-600 truncate">
                                      {brand}
                                      {brand && applianceType ? " • " : ""}
                                      {applianceType}
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PARTS SEARCH */}
            <div className="relative" ref={partBoxRef}>
              <label className="block text-[12px] font-semibold text-white/80 mb-1">
                Search by Part / MPN
              </label>
              <input
                ref={partInputRef}
                value={partQuery}
                onChange={(e) => setPartQuery(e.target.value)}
                onFocus={() => {
                  if ((partQuery || "").trim().length >= 2) {
                    setShowPartDD(true);
                    measureAndSetTop(partInputRef, setPartDDTop);
                  }
                }}
                placeholder="e.g. WD21X25992"
                className="w-full rounded-md px-3 py-2 text-black"
              />

              {showPartDD && (
                <div
                  ref={partDDRef}
                  className="absolute z-50 w-full"
                  style={{ top: partDDTop }}
                >
                  <div className="rounded-xl border border-gray-200 bg-white text-black shadow-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">
                        Parts & Refurbished
                      </div>
                      {loadingParts || loadingRefurb ? (
                        <div className="text-[12px] text-gray-500">Loading…</div>
                      ) : null}
                    </div>

                    {noPartResults && !loadingParts && !loadingRefurb ? (
                      <div className="mt-2 text-sm text-gray-500 italic">
                        No results.
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* LEFT: Refurbished */}
                        <div>
                          <div className="bg-gray-200 text-black font-bold text-sm px-2 py-1 rounded inline-block">
                            Refurbished
                          </div>
                          <div className="mt-2 max-h-[300px] overflow-y-auto pr-1">
                            {visibleRefurb.length === 0 && !loadingRefurb ? (
                              <div className="text-sm text-gray-500 italic">
                                No refurbished parts found.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {visibleRefurb
                                  .slice(0, MAX_REFURB)
                                  .map((p, idx) => {
                                    const mpn = getTrustedMPN(p);
                                    return (
                                      <Link
                                        key={`rf-${idx}-${mpn || idx}`}
                                        to={routeForRefurb(p)}
                                        className="block rounded border border-gray-200 p-2 hover:bg-gray-50 transition"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          setPartQuery("");
                                          setShowPartDD(false);
                                        }}
                                      >
                                        <div className="flex items-start gap-2">
                                          {getThumb(p) && (
                                            <img
                                              src={getThumb(p)}
                                              alt={mpn || "Refurbished Part"}
                                              className="w-10 h-10 object-contain rounded border border-gray-200 bg-white"
                                              loading="lazy"
                                              onError={(e) => {
                                                e.currentTarget.style.display =
                                                  "none";
                                              }}
                                            />
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sm truncate capitalize">
                                              {makePartTitle(p, mpn)}
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-2 text-[13px]">
                                              <span className="font-semibold">
                                                {formatPrice(p)}
                                              </span>
                                              {renderStockBadge(p?.stock_status, {
                                                forceInStock: true,
                                              })}
                                              {mpn && (
                                                <span className="ml-2 text-[11px] font-mono text-gray-600 truncate">
                                                  MPN: {mpn}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </Link>
                                    );
                                  })}

                                {refurbTotalCount > 0 && (
                                  <div className="text-[12px] text-gray-600">
                                    Showing{" "}
                                    {Math.min(visibleRefurb.length, MAX_REFURB)}{" "}
                                    cards • {refurbTotalCount} total offers
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* RIGHT: New Parts */}
                        <div>
                          <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded inline-block">
                            New Parts
                          </div>
                          <div className="mt-2 max-h-[300px] overflow-y-auto pr-1">
                            {visiblePartsSorted.length === 0 && !loadingParts ? (
                              <div className="text-sm text-gray-500 italic">
                                No new parts found.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {visiblePartsSorted
                                  .slice(0, MAX_PARTS)
                                  .map((p, idx) => {
                                    const mpn = getTrustedMPN(p);

                                    return (
                                      <Link
                                        key={`np-${idx}-${mpn || idx}`}
                                        to={routeForPart(p)}
                                        className="block rounded border border-gray-200 p-2 hover:bg-gray-50 transition"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          setPartQuery("");
                                          setShowPartDD(false);
                                        }}
                                      >
                                        <div className="flex items-start gap-2">
                                          {getThumb(p) && (
                                            <img
                                              src={getThumb(p)}
                                              alt={mpn || "Part"}
                                              className="w-10 h-10 object-contain rounded border border-gray-200 bg-white"
                                              loading="lazy"
                                              onError={(e) => {
                                                e.currentTarget.style.display =
                                                  "none";
                                              }}
                                            />
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sm truncate capitalize">
                                              {makePartTitle(p, mpn)}
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-2 text-[13px]">
                                              <span className="font-semibold">
                                                {formatPrice(p)}
                                              </span>
                                              {renderStockBadge(p?.stock_status)}
                                              {typeof partInvCounts?.[mpn] ===
                                                "number" && (
                                                <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                                                  Inv: {partInvCounts[mpn]}
                                                </span>
                                              )}

                                              {mpn && (
                                                <span className="ml-2 text-[11px] font-mono text-gray-600 truncate">
                                                  MPN: {mpn}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </Link>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* END PARTS / OFFERS */}
          </div>
        </div>
      </div>
    </header>
  );
}
