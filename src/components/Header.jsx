// src/components/Header.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";
import { makePartTitle } from "../lib/PartsTitle";

// ====== CONFIG ======
const API_BASE = "https://fastapi-app-kkkq.onrender.com";
const MAX_MODELS = 15;
const MAX_PARTS = 5;
const MAX_REFURB = 5;

const ENABLE_MODEL_ENRICHMENT = false;
const ENABLE_PARTS_COMPARE_PREFETCH = false;

export default function Header() {
  const navigate = useNavigate();

  // -------------------------------------------------
  // STATE
  // -------------------------------------------------
  const [modelQuery, setModelQuery] = useState("");
  const [partQuery, setPartQuery] = useState("");

  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);

  const [refurbTeasers, setRefurbTeasers] = useState([]);
  const [refurbTeaserCount, setRefurbTeaserCount] = useState(0);

  const [modelPartsData, setModelPartsData] = useState({});
  const [brandLogos, setBrandLogos] = useState([]);

  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  const [showModelDD, setShowModelDD] = useState(false);
  const [showPartDD, setShowPartDD] = useState(false);

  const [modelDDTop, setModelDDTop] = useState(0);
  const [partDDTop, setPartDDTop] = useState(0);

  const [modelTotalCount, setModelTotalCount] = useState(null);

  const [facetBrands, setFacetBrands] = useState([]);
  const [facetTypes, setFacetTypes] = useState([]);
  const [loadingFacets, setLoadingFacets] = useState(false);

  const modelInputRef = useRef(null);
  const partInputRef = useRef(null);
  const modelBoxRef = useRef(null);
  const partBoxRef = useRef(null);
  const modelDDRef = useRef(null);
  const partDDRef = useRef(null);

  const modelAbortRef = useRef(null);
  const partAbortRef = useRef(null);
  const facetsAbortRef = useRef(null);

  const MODELS_DEBOUNCE_MS = 750;
  const FACETS_DEBOUNCE_MS = 400;
  const PARTS_DEBOUNCE_MS = 500;
  const modelCacheRef = useRef(new Map());

  const partsSeqRef = useRef(0);
  const modelSeqRef = useRef(0);

  const [compareSummaries, setCompareSummaries] = useState({});

  // -------------------------------------------------
  // HELPERS
  // -------------------------------------------------
  const normalize = (s) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  const normLen = (s) => normalize(s).length;

  const getTrustedMPN = (p) => {
    const clean = (x) => (x == null ? "" : String(x).trim());
    return (
      clean(p?.mpn_coalesced) ||
      clean(p?.mpn_display) ||
      clean(p?.mpn) ||
      clean(p?.manufacturer_part_number) ||
      clean(p?.part_number) ||
      clean(p?.sku) ||
      ""
    );
  };

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
    const nq = (q || "").trim();
    const k = normalize(nq);
    if (!k) return { brand: null, prefix: null };
    if (brandSet.has(k)) return { brand: brandSet.get(k), prefix: "" };
    const first = k.split(/\s+/)[0];
    if (brandSet.has(first)) {
      const brand = brandSet.get(first);
      const after = k.slice(first.length).trim();
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

  const numericPrice = (p) => {
    const n =
      p?.price_num ??
      p?.price_numeric ??
      (typeof p?.price === "number"
        ? p.price
        : Number(String(p?.price || "").replace(/[^a-z0-9.]/gi, "")));
    return Number.isFinite(Number(n)) ? Number(n) : null;
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

  const isTrulyUnavailableNew = (p) => {
    const n = numericPrice(p);
    const stock = (p?.stock_status || "").toLowerCase();
    const discontinued = /(discontinued|nla|no\s+longer\s+available|reference)/i.test(
      stock
    );
    return (n == null || n <= 0) && discontinued;
  };

  const isTrulyUnavailableRefurb = (p) => {
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
    const mpn = getTrustedMPN(p);
    return mpn ? `/parts/${encodeURIComponent(mpn)}` : "/page-not-found";
  };

  const routeForRefurb = (p) => {
    const mpn = getTrustedMPN(p);
    if (!mpn) return "/page-not-found";
    const offerId =
      p?.offer_id ?? p?.listing_id ?? p?.ebay_id ?? p?.item_id ?? p?.id ?? null;
    const qs = offerId ? `?offer=${encodeURIComponent(String(offerId))}` : "";
    return `/refurb/${encodeURIComponent(mpn)}${qs}`;
  };

  const measureAndSetTop = (ref, setter) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setter(rect.bottom + 8);
  };

  // (click-out & resize logic omitted for brevity – unchanged)

  // ───────────────────────────────────────────────
  // buildRefurbSearchUrl (with fix #3)
  // ───────────────────────────────────────────────
  const APPLIANCE_WORDS = [
    "washer","washing","dryer","dishwasher","fridge","refrigerator","freezer",
    "range","oven","stove","cooktop","microwave","hood","icemaker","ice maker"
  ];
  const PART_WORDS = [
    "board","control","pump","valve","motor","sensor","thermistor","heater",
    "switch","knob","belt","door","gasket","seal","filter","hose","element",
    "igniter","regulator","rack","shelf","module","relay","compressor","gear"
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
    // ★ FIX #3 – skip redundant refurb API call for brand-only input
    if (guess.brand && guess.prefix === "") {
      return "";
    }
    if (guess.brand && guess.prefix) {
      return `${API_BASE}/api/suggest/refurb/search?model=${encodeURIComponent(
        q
      )}&brand=${encodeURIComponent(guess.brand)}&limit=10&order=price_desc`;
    }
    return `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(q)}&limit=10`;
  };

  // ───────────────────────────────────────────────
  // PARTS + REFURB (debounced)  — fixes #1 + #2
  // ───────────────────────────────────────────────
  useEffect(() => {
    const q = (partQuery || "").trim();

    // ★ FIX #1: don’t hide or clear on short query
    if (q.length < 2) {
      partAbortRef.current?.abort?.();
      return;
    }

    partAbortRef.current?.abort?.();
    const controller = new AbortController();
    partAbortRef.current = controller;

    // ★ FIX #2: shared sequence guard
    const seq = ++partsSeqRef.current;

    const t = setTimeout(async () => {
      setLoadingParts(true);
      setLoadingRefurb(true);

      try {
        const params = { signal: controller.signal };

        const [pRes, rRes] = await Promise.allSettled([
          axios.get(buildPartsSearchUrlPrimary(q), params).catch(() => null),
          axios.get(buildRefurbSearchUrl(q), params).catch(() => null),
        ]);

        if (seq !== partsSeqRef.current) return; // ignore stale

        let partsArr = [];
        if (pRes.status === "fulfilled" && pRes.value) {
          partsArr = parseArrayish(pRes.value.data);
          if ((!Array.isArray(partsArr) || partsArr.length === 0) && !controller.signal.aborted) {
            try {
              const r2 = await axios.get(buildPartsSearchUrlFallback(q), params);
              partsArr = parseArrayish(r2.data);
            } catch {}
          }
        }

        const refurbArr =
          rRes.status === "fulfilled" && rRes.value
            ? parseArrayish(rRes.value.data)
            : [];

        setPartSuggestions((prev) =>
          Array.isArray(partsArr) && partsArr.length > 0
            ? partsArr.slice(0, MAX_PARTS)
            : prev
        );
        setRefurbSuggestions((prev) =>
          Array.isArray(refurbArr) && refurbArr.length > 0
            ? refurbArr.slice(0, MAX_REFURB)
            : prev
        );

        setShowPartDD(true);
        measureAndSetTop(partInputRef, setPartDDTop);
      } catch {
        // keep previous results
      } finally {
        if (partsSeqRef.current === seq) {
          setLoadingParts(false);
          setLoadingRefurb(false);
        }
      }
    }, PARTS_DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [partQuery]);

  // (remaining model logic, JSX rendering etc. — unchanged)
}
