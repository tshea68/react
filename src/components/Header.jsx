// src/components/Header.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";
import { makePartTitle } from "../lib/PartsTitle";
import CartWidget from "./CartWidget"; // <-- added

// ====== CONFIG ======
const API_BASE = "https://fastapi-app-kkkq.onrender.com";
const MAX_MODELS = 15;
const MAX_PARTS = 5;
const MAX_REFURB = 5;

const ENABLE_MODEL_ENRICHMENT = false;
const ENABLE_PARTS_COMPARE_PREFETCH = false;

export default function Header() {
  const navigate = useNavigate();

  // STATE
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

  // Facets for the Models dropdown (brands + appliance types)
  const [facetBrands, setFacetBrands] = useState([]);
  const [facetTypes, setFacetTypes] = useState([]);
  const [loadingFacets, setLoadingFacets] = useState(false);

  // NEW: facet selection state so we can hand it to PartsExplorer later
  const [facetFilter, setFacetFilter] = useState(null);

  // refs
  const modelInputRef = useRef(null);
  const partInputRef = useRef(null);
  const modelBoxRef = useRef(null);
  const partBoxRef = useRef(null);
  const modelDDRef = useRef(null);
  const partDDRef = useRef(null);

  const modelAbortRef = useRef(null);
  const partAbortRef = useRef(null);
  const facetsAbortRef = useRef(null);

  // debounce timings
  const MODELS_DEBOUNCE_MS = 750;
  const FACETS_DEBOUNCE_MS = 400;
  const PARTS_DEBOUNCE_MS = 500;

  // stale-result / cache guards
  const modelCacheRef = useRef(new Map()); // url -> {data, headers, ts}
  const partsSeqRef = useRef(0);
  const modelSeqRef = useRef(0);

  // prefetch summaries (off by default)
  const [compareSummaries, setCompareSummaries] = useState({});

  // =========================
  // HELPERS
  // =========================
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

    if (brandSet.has(k)) {
      return { brand: brandSet.get(k), prefix: "" };
    }

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
            : Number(
                String(pObjOrNumber?.price || "").replace(/[^0-9.]/g, "")
              ));

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
    const outish = /(out\s*of\s*stock|ended|unavailable|sold\s*out)/i.test(
      stock
    );
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
      p?.offer_id ??
      p?.listing_id ??
      p?.ebay_id ??
      p?.item_id ??
      p?.id ??
      null;
    const qs = offerId ? `?offer=${encodeURIComponent(String(offerId))}` : "";
    return `/refurb/${encodeURIComponent(mpn)}${qs}`;
  };

  // NEW: go to model page from suggestion card
const openModel = (modelNumber) => {
  if (!modelNumber) return;
  navigate(`/model?model=${encodeURIComponent(modelNumber)}`); // <-- THIS IS WHAT YOUR APP EXPECTS
  setModelQuery("");
  setShowModelDD(false);
};

  // NEW: facet click handler (brand / appliance type pills)
  const applyFacetFilter = (payload) => {
    // payload example: { brand: "Whirlpool" } or { appliance_type: "Dryer" }
    setFacetFilter(payload);
    // later you'll lift this state up and feed it to <PartsExplorer externalFacet={...}/>
    // for now we just close the dropdown so it feels instant and doesn't navigate
    setShowModelDD(false);
  };

  const measureAndSetTop = (ref, setter) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setter(rect.bottom + 8);
  };

  // CLICK OUTSIDE + RESIZE HANDLERS
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

  // BOOT: brand logos
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/brand-logos`)
      .then((r) =>
        setBrandLogos(Array.isArray(r.data) ? r.data : r.data?.logos || [])
      )
      .catch(() => {});
  }, []);

  // helper: server total
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

  // URL BUILDERS
  const buildSuggestUrl = ({ brand, prefix, q }) => {
    const params = new URLSearchParams();
    params.set("limit", String(MAX_MODELS));

    const qLen = normLen(q);
    const pLen = normLen(prefix);
    const isBrandOnly = !!brand && (prefix === "" || prefix == null);

    const includeCounts = isBrandOnly
      ? false
      : qLen >= 4 || pLen >= 2;
    const includeRefurbOnly = !isBrandOnly && qLen >= 4;

    if (brand) {
      params.set("brand", brand);
      if (prefix) params.set("q", prefix);
    } else if (qLen >= 2) {
      params.set("q", q);
    }

    params.set("include_counts", includeCounts ? "true" : "false");
    params.set(
      "include_refurb_only",
      includeRefurbOnly ? "true" : "false"
    );
    params.set("src", "modelbar");

    return `${API_BASE}/api/suggest?${params.toString()}`;
  };

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
      return `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(
        q
      )}&limit=10`;
    }
    if (guess.brand && guess.prefix === "") {
      return `${API_BASE}/api/suggest/refurb/search?brand=${encodeURIComponent(
        guess.brand
      )}&q=${encodeURIComponent(q)}&limit=10&order=price_desc`;
    }
    if (guess.brand && guess.prefix) {
      return `${API_BASE}/api/suggest/refurb/search?model=${encodeURIComponent(
        q
      )}&brand=${encodeURIComponent(
        guess.brand
      )}&limit=10&order=price_desc`;
    }
    return `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(
      q
    )}&limit=10`;
  };

  // MODELS FETCH (debounced, stale-safe)
  useEffect(() => {
    const q = modelQuery?.trim();

    if (!q || q.length < 2) {
      setShowModelDD(false);
      modelAbortRef.current?.abort?.();
      facetsAbortRef.current?.abort?.();
      setLoadingFacets(false);
      return;
    }

    modelAbortRef.current?.abort?.();
    const controller = new AbortController();
    modelAbortRef.current = controller;
    const runId = ++modelSeqRef.current;

    const timer = setTimeout(async () => {
      setLoadingModels(true);

      const fromCache = (url) =>
        modelCacheRef.current.get(url) || null;
      const toCache = (url, data, headers) =>
        modelCacheRef.current.set(url, {
          data,
          headers,
          ts: Date.now(),
        });

      try {
        const guess = parseBrandPrefix(q);
        const primaryUrl = buildSuggestUrl({ ...guess, q });

        let resData, resHeaders;
        const cachedPrimary = fromCache(primaryUrl);
        if (cachedPrimary) {
          resData = cachedPrimary.data;
          resHeaders = cachedPrimary.headers;
        } else {
          const res = await axios.get(primaryUrl, {
            signal: controller.signal,
          });
          resData = res.data;
          resHeaders = res.headers;
          toCache(primaryUrl, resData, resHeaders);
        }

        if (modelSeqRef.current !== runId) return; // stale

        let withP = resData?.with_priced_parts || [];
        let noP = resData?.without_priced_parts || [];
        let models = [...withP, ...noP];
        let total = extractServerTotal(resData, resHeaders);

        const brandPrefixLen = normLen(guess.prefix);
        const canFallback = !!guess.brand && brandPrefixLen >= 2;

        if (
          (models.length === 0 || total === 0 || total == null) &&
          canFallback &&
          !controller.signal.aborted
        ) {
          const fallbackUrl = buildSuggestUrl({ brand: null, q });
          const cachedFallback = fromCache(fallbackUrl);
          if (cachedFallback) {
            resData = cachedFallback.data;
            resHeaders = cachedFallback.headers;
          } else {
            const res2 = await axios.get(fallbackUrl, {
              signal: controller.signal,
            });
            resData = res2.data;
            resHeaders = res2.headers;
            toCache(fallbackUrl, resData, resHeaders);
          }

          if (modelSeqRef.current !== runId) return; // stale

          withP = resData?.with_priced_parts || [];
          noP = resData?.without_priced_parts || [];
          models = [...withP, ...noP];
          total = extractServerTotal(resData, resHeaders);
        }

        setModelTotalCount((prev) =>
          typeof total === "number" ? total : prev
        );

        const stats = {};
        for (const m of models) {
          stats[m.model_number] = {
            total: m.total_parts ?? 0,
            priced: m.priced_parts ?? 0,
            refurb:
              typeof m.refurb_count === "number"
                ? m.refurb_count
                : null,
          };
        }

        setModelSuggestions((prev) =>
          Array.isArray(models) && models.length > 0
            ? models.slice(0, MAX_MODELS)
            : prev
        );

        setModelPartsData((prev) =>
          Object.keys(stats).length > 0 ? stats : prev
        );

        setShowModelDD(true);
        measureAndSetTop(modelInputRef, setModelDDTop);

        // refurb teaser fetch
        try {
          let teaserUrl = "";
          if (guess.brand && guess.prefix === "") {
            teaserUrl = `${API_BASE}/api/suggest/refurb/search?brand=${encodeURIComponent(
              guess.brand
            )}&q=${encodeURIComponent(
              q
            )}&limit=12&order=price_desc`;
          } else if (guess.brand && guess.prefix) {
            teaserUrl = `${API_BASE}/api/suggest/refurb/search?model=${encodeURIComponent(
              q
            )}&brand=${encodeURIComponent(
              guess.brand
            )}&limit=12&order=price_desc`;
          } else {
            teaserUrl = `${API_BASE}/api/suggest/refurb/search?model=${encodeURIComponent(
              q
            )}&limit=12&order=price_desc`;
          }

          const r = await axios.get(teaserUrl, {
            signal: controller.signal,
          });
          if (modelSeqRef.current !== runId) return; // stale

          const items = Array.isArray(r.data?.results)
            ? r.data.results
            : parseArrayish(r.data);
          const count =
            typeof r.data?.count === "number"
              ? r.data.count
              : items.length;

          setRefurbTeasers((prev) =>
            items.length > 0 ? items.slice(0, 3) : prev
          );
          setRefurbTeaserCount((prev) =>
            typeof count === "number" ? count : prev
          );
        } catch {
          // ignore
        }
      } catch (err) {
        if (err?.name !== "CanceledError") console.error(err);
        setShowModelDD(true);
        measureAndSetTop(modelInputRef, setModelDDTop);
      } finally {
        if (modelSeqRef.current === runId) setLoadingModels(false);
      }
    }, MODELS_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [modelQuery, brandSet]);

  // FACETS FETCH (debounced)
  useEffect(() => {
    const q = modelQuery?.trim();
    if (!showModelDD || !q || q.length < 2) {
      facetsAbortRef.current?.abort?.();
      setLoadingFacets(false);
      return;
    }

    facetsAbortRef.current?.abort?.();
    const controller = new AbortController();
    facetsAbortRef.current = controller;

    const timer = setTimeout(async () => {
      setLoadingFacets(true);
      try {
        const params = new URLSearchParams();
        params.set("scope", "models");
        params.set("q", q);
        params.set("limit", "12");
        const url = `${API_BASE}/api/facets?${params.toString()}`;
        const r = await axios.get(url, { signal: controller.signal });

        const brands = Array.isArray(r.data?.brands) ? r.data.brands : [];
        const types = Array.isArray(r.data?.appliance_types)
          ? r.data.appliance_types
          : [];

        if (brands.length > 0) setFacetBrands(brands.slice(0, 12));
        if (types.length > 0) setFacetTypes(types.slice(0, 12));
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

  // PARTS + REFURB FETCH (debounced, stale-safe)
  useEffect(() => {
    const q = (partQuery || "").trim();

    if (q.length < 2) {
      setShowPartDD(false);
      partAbortRef.current?.abort?.();
      return;
    }

    partAbortRef.current?.abort?.();
    const controller = new AbortController();
    partAbortRef.current = controller;
    const runId = ++partsSeqRef.current;

    const t = setTimeout(async () => {
      setLoadingParts(true);
      setLoadingRefurb(true);

      try {
        const params = { signal: controller.signal };

        const [pRes, rRes] = await Promise.allSettled([
          axios.get(buildPartsSearchUrlPrimary(q), params).catch(() => null),
          axios.get(buildRefurbSearchUrl(q), params).catch(() => null),
        ]);

        if (partsSeqRef.current !== runId) return; // stale

        let partsArr = [];
        if (pRes.status === "fulfilled" && pRes.value) {
          partsArr = parseArrayish(pRes.value.data);

          if (
            (!Array.isArray(partsArr) || partsArr.length === 0) &&
            !controller.signal.aborted
          ) {
            try {
              const r2 = await axios.get(
                buildPartsSearchUrlFallback(q),
                params
              );
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
        // keep old results
      } finally {
        if (partsSeqRef.current === runId) {
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

  // DERIVED LISTS + SORT
  const visibleParts = partSuggestions.filter((p) => !isTrulyUnavailableNew(p));
  const visibleRefurb = refurbSuggestions.filter(
    (p) => !isTrulyUnavailableRefurb(p)
  );

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

  // PREFETCH COMPARE (still off)
  useEffect(() => {
    if (!ENABLE_MODEL_ENRICHMENT) return;
    if (!ENABLE_PARTS_COMPARE_PREFETCH || !showPartDD) return;

    const norm = normalize;
    const keys = new Set();
    for (const p of visiblePartsSorted) {
      const k = norm(getTrustedMPN(p));
      if (k) keys.add(k);
    }
    for (const p of visibleRefurb) {
      const k = norm(getTrustedMPN(p));
      if (k) keys.add(k);
    }
    const pending = [...keys].filter((k) => !(k in compareSummaries));
    if (pending.length === 0) return;

    axios
      .post(`${API_BASE}/api/compare/xmarket/bulk`, {
        keys: pending,
      })
      .then((r) => {
        const items = r?.data?.items || {};
        if (items && typeof items === "object") {
          setCompareSummaries((prev) => ({
            ...prev,
            ...items,
          }));
        }
      })
      .catch(() => {});
  }, [showPartDD, visiblePartsSorted, visibleRefurb, compareSummaries]);

  // RENDER PREP
  const sortedModelSuggestions = useMemo(
    () => modelSuggestions.slice(0, MAX_MODELS),
    [modelSuggestions]
  );
  const renderedModelsCount = sortedModelSuggestions.length;
  const totalText =
    typeof modelTotalCount === "number" ? modelTotalCount : "—";

  // facet helpers
  const facetLabel = (x) => (x?.label || x?.value || "").toString();
  const facetValue = (x) => (x?.value || x?.label || "").toString();
  const facetCount = (x) => Number(x?.count ?? 0);

  // teaser heading text
  const teaserHeading = (() => {
    const q = (modelQuery || "").trim();
    if (!q) return "Sample refurbished parts";
    return `Sample refurbished parts for “${q}”`;
  })();

  // =========================
  // RENDER
  // =========================
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

        {/* Menu + Cart */}
        <div className="col-span-8 md:col-span-9 lg:col-span-10 flex items-center justify-center md:justify-between">
          {/* left side: header links / policy nav */}
          <HeaderMenu />

          {/* right side: cart icon/badge */}
          <div className="hidden md:flex items-center">
            <CartWidget />
          </div>
        </div>

        {/* Search Inputs */}
        <div className="col-span-12 md:col-span-9 lg:col-span-10 md:col-start-4 lg:col-start-3">
          <div className="flex flex-wrap justify-center gap-4">
            {/* MODELS input */}
            <div ref={modelBoxRef} className="relative">
              <input
                ref={modelInputRef}
                type="text"
                placeholder="Search for your part by model number"
                className="w-[420px] max-w-[92vw] border-4 border-yellow-400 pr-4 pl-12 px-3 py-2 rounded text-black text-sm md:text-base font-medium"
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
                  className="animate-spin-clock h-6 w-6 text-gray-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-label="Searching"
                  role="status"
                >
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
                  <path d="M12 12 L12 5" />
                </svg>
              )}

              {showModelDD && (
                <div
                  ref={modelDDRef}
                  className="fixed left-1/2 -translate-x-1/2 bg-white text-black border rounded shadow-xl z-20 ring-1 ring-black/5"
                  style={{ top: modelDDTop, width: "min(96vw,1100px)" }}
                >
                  <div className="p-3">
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                      <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded inline-block">
                        Models
                      </div>

                      {(loadingModels || loadingFacets) && (
                        <div className="text-xs text-gray-600 flex items-center gap-2 ml-3">
                          <svg
                            className="animate-spin-clock h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              strokeOpacity="0.2"
                            />
                            <path d="M12 12 L12 5" />
                          </svg>
                          <span>Searching…</span>
                        </div>
                      )}
                    </div>

                    {(refurbTeasers.length > 0 ||
                      sortedModelSuggestions.length > 0 ||
                      facetBrands.length > 0 ||
                      facetTypes.length > 0) ? (
                      <div className="mt-2 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3">
                        {/* MAIN COLUMN */}
                        <div className="max-h-[300px] overflow-y-auto overscroll-contain pr-1">
                          {/* Refurb teaser block */}
                          {refurbTeasers.length > 0 && (
                            <div className="mb-2">
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-[11px] text-gray-600 font-semibold">
                                  {teaserHeading}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {refurbTeasers.map((p, i) => {
                                  const mpn = getTrustedMPN(p);
                                  const priceText = formatPrice(p);
                                  const typed = modelQuery.trim();
                                  return (
                                    <Link
                                      key={`rt-${i}-${mpn || i}`}
                                      to={routeForRefurb(p)}
                                      className="rounded-lg border border-gray-200 p-2 bg-gray-50 hover:bg-gray-100 transition"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        setModelQuery("");
                                        setShowModelDD(false);
                                      }}
                                      title={mpn || "Refurbished Part"}
                                    >
                                      <div className="flex items-start gap-2">
                                        {getThumb(p) && (
                                          <img
                                            src={getThumb(p)}
                                            alt={mpn || "Refurbished Part"}
                                            className="w-9 h-9 object-contain rounded border border-gray-200 bg-white"
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
                                              {priceText || ""}
                                            </span>
                                            {renderStockBadge(
                                              p?.stock_status,
                                              { forceInStock: true }
                                            )}
                                          </div>
                                          {typed && (
                                            <div className="mt-0.5 text-xs text-gray-600 truncate">
                                              Fits many “{typed}” models
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </Link>
                                  );
                                })}
                              </div>

                              <div className="mt-2 border-t" />
                            </div>
                          )}

                          {/* "Showing X of Y Models" */}
                          <div className="text-xs text-gray-600 mb-2">
                            {`Showing ${renderedModelsCount} of ${totalText} Models`}
                          </div>

                          {/* Models grid */}
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
                                <button
                                  key={`m-${i}`}
                                  className="text-left w-full rounded-lg border p-3 hover:bg-gray-50 transition"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => openModel(m.model_number)}
                                >
                                  <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto_auto] gap-x-3 gap-y-1">
                                    <div className="col-start-1 row-start-1 font-medium truncate">
                                      {m.brand} •{" "}
                                      <span className="text-gray-600">
                                        Model:
                                      </span>{" "}
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
                                            typeof s.refurb === "number" &&
                                            s.refurb > 0
                                              ? "bg-emerald-50 text-emerald-700"
                                              : "bg-gray-100 text-gray-600"
                                          }`}
                                        >
                                          {typeof s.refurb === "number"
                                            ? s.refurb
                                            : 0}
                                        </span>
                                      </span>
                                      <span>Known: {s.total}</span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* SIDEBAR: facets */}
                        <aside className="lg:border-l lg:pl-3 max-h-[300px] overflow-y-auto">
                          {(facetBrands.length > 0 ||
                            facetTypes.length > 0) && (
                            <div className="space-y-3">
                              {facetBrands.length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-gray-700 mb-1">
                                    Brands
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {facetBrands.map((b, i) => (
                                      <button
                                        key={`fb-${i}`}
                                        type="button"
                                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800"
                                        onMouseDown={(e) =>
                                          e.preventDefault()
                                        }
                                        onClick={() => {
                                          applyFacetFilter({
                                            brand: facetValue(b),
                                          });
                                        }}
                                        title={facetLabel(b)}
                                      >
                                        {facetLabel(b)}{" "}
                                        <span className="text-[11px] text-gray-600">
                                          ({facetCount(b)})
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {facetTypes.length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-gray-700 mb-1">
                                    Appliance types
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {facetTypes.map((t, i) => (
                                      <button
                                        key={`ft-${i}`}
                                        type="button"
                                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800"
                                        onMouseDown={(e) =>
                                          e.preventDefault()
                                        }
                                        onClick={() => {
                                          applyFacetFilter({
                                            appliance_type: facetValue(t),
                                          });
                                        }}
                                        title={facetLabel(t)}
                                      >
                                        {facetLabel(t)}{" "}
                                        <span className="text-[11px] text-gray-600">
                                          ({facetCount(t)})
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </aside>
                      </div>
                    ) : (
                      !loadingModels &&
                      !loadingFacets && (
                        <div className="mt-2 text-sm text-gray-500 italic">
                          No model matches found.
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PARTS / OFFERS input */}
            <div ref={partBoxRef} className="relative">
              <input
                ref={partInputRef}
                type="text"
                placeholder="Search parts / MPN"
                className="w-[420px] max-w-[92vw] border-4 border-yellow-400 px-3 py-2 pr-4 pl-12 rounded text-black text-sm md:text-base font-medium"
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
              {(loadingParts || loadingRefurb) &&
                partQuery.trim().length >= 2 && (
                  <svg
                    className="animate-spin-clock h-6 w-6 text-gray-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-label="Searching"
                    role="status"
                  >
                    <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
                    <path d="M12 12 L12 5" />
                  </svg>
                )}

              {showPartDD && (
                <div
                  ref={partDDRef}
                  className="fixed left-1/2 -translate-x-1/2 bg-white text-black border rounded shadow-xl z-20 ring-1 ring-black/5"
                  style={{
                    top: partDDTop,
                    width: "min(96vw,1100px)",
                  }}
                >
                  <div className="p-3">
                    {(loadingParts || loadingRefurb) && (
                      <div className="text-gray-600 text-sm flex items-center mb-2 gap-2">
                        <svg
                          className="animate-spin-clock h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            strokeOpacity="0.2"
                          />
                          <path d="M12 12 L12 5" />
                        </svg>
                        <span>Searching…</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* LEFT: New Parts */}
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
                              {visiblePartsSorted.map((p, idx) => {
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

                      {/* RIGHT: Refurbished */}
                      <div>
                        <div className="bg-emerald-500 text-white font-bold text-sm px-2 py-1 rounded inline-block">
                          Refurbished
                        </div>
                        <div className="mt-2 max-h-[300px] overflow-y-auto pr-1">
                          {visibleRefurb.length === 0 && !loadingRefurb ? (
                            <div className="text-sm text-gray-500 italic">
                              No refurbished parts found.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {visibleRefurb.map((p, idx) => {
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
                                          {renderStockBadge(
                                            p?.stock_status,
                                            { forceInStock: true }
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
