// src/components/Header.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";
import { makePartTitle } from "../lib/PartsTitle"; // custom title builder

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const MAX_MODELS = 15;
const MAX_PARTS = 5;
const MAX_REFURB = 5;

// (Enrichment stays off; we’re only showing suggest data in the dropdowns)
const ENABLE_MODEL_ENRICHMENT = false;
// const ENABLE_PARTS_COMPARE_PREFETCH = false;
const ENABLE_PARTS_COMPARE_PREFETCH = true; // turn on compare prefetch

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

  // models debounce + cache + stale guard (surgical)
  const MODELS_DEBOUNCE_MS = 750;
  const modelLastQueryRef = useRef("");            // ignore stale responses
  const modelCacheRef = useRef(new Map());         // key: URL, val: {data, headers, ts}

  // Compatibility stubs (no enrichment writes)
  const [modelRefurbInfo] = useState({});
  const [compareSummaries, setCompareSummaries] = useState({}); // stateful

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

    // >>> NEW: hard guard so we never treat an eBay/listing id as an MPN
    if (
      /^\d{10,}$/.test(s) ||                            // long all-digits (typical eBay id)
      s === String(p?.offer_id || "") ||
      s === String(p?.listing_id || "") ||
      s === String(p?.ebay_id || "") ||
      s === String(p?.id || "")
    ) {
      return "";
    }
    // <<<

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
    // Keep this permissive—offers are usually available
    const qty = Number(p?.quantity_available ?? p?.quantity ?? 1);
    const stock = (p?.stock_status || p?.availability || "").toLowerCase();
    const outish = /(out\s*of\s*stock|ended|unavailable|sold\s*out)/i.test(stock);
    return outish && qty <= 0;
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

  // 🔧 drop-in replacement for routeForRefurb (surgical change only)
  const routeForRefurb = (p) => {
    // Prefer a local offer route your SingleProduct flow expects:
    // 1) /offer/:id
    const id = p?.id ?? p?.offer_id ?? p?.internal_id ?? p?.slug;
    if (id) return `/offer/${encodeURIComponent(String(id))}`;

    // 2) /offer/:source/:listing_id (e.g., ebay/195834364603)
    const source = p?.source || p?.market || p?.vendor;
    const listingId = p?.listing_id || p?.ebay_item_id || p?.item_id || p?.ebay_id;
    if (source && listingId) {
      return `/offer/${encodeURIComponent(source)}/${encodeURIComponent(String(listingId))}`;
    }

    // 3) Fallback: your existing querystring page (/refurb?mpn=...&offer=...)
    const mpn = extractMPN(p);
    if (!mpn) return "/page-not-found";
    const qs = new URLSearchParams({ mpn });
    const offer = p?.offer_id || p?.listing_id || p?.id || listingId;
    if (offer) qs.set("offer", String(offer));
    return `/refurb?${qs.toString()}`;
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

  /* ---------------- fetch MODELS (debounced, cached, stale-safe) ---------------- */
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

    // track the query we’re issuing (stale guard)
    modelLastQueryRef.current = q;

    const timer = setTimeout(async () => {
      setLoadingModels(true);
      try {
        const guess = parseBrandPrefix(q);

        // Build primary URL (brand-param path if we detected a brand)
        const primaryUrl = buildSuggestUrl({ ...guess, q });
        const fallbackUrl = buildSuggestUrl({ brand: null, q });

        // helper: read from cache
        const fromCache = (url) => {
          const hit = modelCacheRef.current.get(url);
          return hit ? hit : null;
        };

        // helper: write to cache
        const toCache = (url, data, headers) => {
          modelCacheRef.current.set(url, { data, headers, ts: Date.now() });
        };

        // Try cached primary first
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
        let
