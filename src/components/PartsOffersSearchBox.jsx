// src/components/PartsOffersSearchBox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://api.appliancepartgeeks.com";
const MAX_PARTS = 10;
const MAX_REFURB = 10;

// Cloudflare Worker for Reliable availability
const AVAIL_URL = "https://inventorychecker.timothyshea.workers.dev";
const DEFAULT_ZIP = "10001";

export default function PartsOffersSearchBox() {
  const navigate = useNavigate();

  // ===== STATE =====
  const [partQuery, setPartQuery] = useState("");

  const [partSuggestions, setPartSuggestions] = useState([]);
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);
  const [refurbTotalCount, setRefurbTotalCount] = useState(0);

  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  const [showPartDD, setShowPartDD] = useState(false);
  const [partDDTop, setPartDDTop] = useState(0);

  const [noPartResults, setNoPartResults] = useState(false);

  // inventory counts (cached)
  const [partInvCounts, setPartInvCounts] = useState({});
  const partInvCacheRef = useRef(new Map());

  const [refurbInvCounts, setRefurbInvCounts] = useState({});
  const refurbInvCacheRef = useRef(new Map());

  // refs
  const partInputRef = useRef(null);
  const partBoxRef = useRef(null);
  const partDDRef = useRef(null);

  const partAbortRef = useRef(null);
  const partsSeqRef = useRef(0);

  // debounce
  const PARTS_DEBOUNCE_MS = 500;

  // ===== HELPERS =====
  const clean = (x) => (x == null ? "" : String(x).trim());
  const normalize = (s) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  const normLen = (s) => normalize(s).length;

  const measureAndSetTop = (ref, setter) => {
    const rect = ref?.current?.getBoundingClientRect?.();
    if (!rect) return;
    setter(rect.bottom + 8);
  };

  const getTrustedMPN = (p) => {
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
    const outish = /(out\s*of\s*stock|ended|unavailable|sold\s*out)/i.test(
      stock
    );
    return outish && qty <= 0;
  };

  const renderStockBadge = (raw, { forceInStock = false } = {}) => {
    if (forceInStock) {
      return (
        <span className="inline-flex items-center rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold text-white">
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
        <span className="inline-flex items-center rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold text-white">
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

  const routeForPart = (p) => {
    const mpn = getTrustedMPN(p);
    return mpn ? `/parts/${encodeURIComponent(mpn)}` : "/page-not-found";
  };

  const routeForRefurb = (p) => {
    const raw = getTrustedMPN(p);
    if (!raw) return "/page-not-found";

    const mpnNorm = normalize(raw);

    const offerId =
      p?.offer_id ??
      p?.listing_id ??
      p?.ebay_id ??
      p?.item_id ??
      p?.id ??
      null;

    const qs = offerId ? `?offer=${encodeURIComponent(String(offerId))}` : "";
    return `/refurb/${encodeURIComponent(mpnNorm)}${qs}`;
  };

  const getThumb = (p) => p?.image_url || p?.image || p?.thumbnail_url || null;

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
      title: p?.title || title,
      name: p?.name || title,
      brand: p?.brand || p?.brand_name || p?.oem_brand || "",
      appliance_type: p?.appliance_type || p?.appliance || p?.category || "",
      part_type: p?.part_type || p?.part_category || p?.type || "",
    };
  };

  // brand prefix parsing for "brand-only intent"
  const parseBrandPrefix = (q) => {
    const nq = (q || "").trim();
    const k = normalize(nq);
    if (!k) return { brand: null, prefix: null };

    // NOTE: this version is conservative (no brand set in this component),
    // but it still supports "brand-only" intent via explicit brand= in query.
    // If you want full brand detection here later, we can pass brandLogos as props.
    return { brand: null, prefix: k };
  };

  const hasBrandOnlyIntent = (q) => {
    // With the simplified parser, we treat empty prefix as not brand-only.
    // You can expand this later by passing brandSet/brandLogos in props.
    const guess = parseBrandPrefix(q);
    return !!guess?.brand && (guess.prefix === "" || guess.prefix == null);
  };

  // URL builders (preserve your existing endpoints)
  const buildPartsSearchUrlPrimary = (qRaw) => {
    const params = new URLSearchParams();
    params.set("limit", "10");
    params.set("in_stock", "true");
    params.set("q", qRaw || "");
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
    const trimmed = (q || "").trim();
    if (looksLikeApplianceOrPart(trimmed)) {
      return `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(
        trimmed
      )}&limit=10`;
    }
    return `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(
      trimmed
    )}&limit=10`;
  };

  // Worker fetch + cache (NEW parts)
  const fetchInventoryCount = async (mpn, zip = DEFAULT_ZIP) => {
    const m = (mpn || "").trim();
    if (!m) return null;

    // ✅ normalize cache key so variants of the same MPN dedupe
    const mpnKey = normalize(m);
    const key = `${mpnKey.toUpperCase()}|${zip}`;
    if (partInvCacheRef.current.has(key)) return partInvCacheRef.current.get(key);

    try {
      const res = await fetch(`${AVAIL_URL}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partNumber: m, postalCode: zip, quantity: 1 }),
      });
      if (!res.ok) throw new Error(`inventory status ${res.status}`);
      const data = await res.json();

      // ✅ preserve 0 (previous logic dropped it)
      const pickNum = (v) =>
        typeof v === "number" && Number.isFinite(v) ? v : null;

      const count =
        pickNum(data?.totalAvailable) ??
        pickNum(data?.total_available) ??
        pickNum(data?.available) ??
        pickNum(data?.qty) ??
        null;

      partInvCacheRef.current.set(key, count);
      return count;
    } catch {
      partInvCacheRef.current.set(key, null);
      return null;
    }
  };

  // Worker fetch + cache (REFURB)
  const fetchRefurbInventoryCount = async (mpn, zip = DEFAULT_ZIP) => {
    const m = (mpn || "").trim();
    if (!m) return null;

    // ✅ normalize cache key so variants of the same MPN dedupe
    const mpnKey = normalize(m);
    const key = `${mpnKey.toUpperCase()}|${zip}`;
    if (refurbInvCacheRef.current.has(key))
      return refurbInvCacheRef.current.get(key);

    try {
      const res = await fetch(`${AVAIL_URL}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partNumber: m, postalCode: zip, quantity: 1 }),
      });
      if (!res.ok) throw new Error(`inventory status ${res.status}`);
      const data = await res.json();

      // ✅ preserve 0 (previous logic dropped it)
      const pickNum = (v) =>
        typeof v === "number" && Number.isFinite(v) ? v : null;

      const count =
        pickNum(data?.totalAvailable) ??
        pickNum(data?.total_available) ??
        pickNum(data?.available) ??
        pickNum(data?.qty) ??
        null;

      refurbInvCacheRef.current.set(key, count);
      return count;
    } catch {
      refurbInvCacheRef.current.set(key, null);
      return null;
    }
  };

  const openPart = (mpn) => {
    if (!mpn) return;
    navigate(`/parts/${encodeURIComponent(mpn)}`);
    setPartQuery("");
    setShowPartDD(false);
  };

  // ===== CLICK OUTSIDE / RESIZE =====
  useEffect(() => {
    const onDown = (e) => {
      const inPart =
        partBoxRef.current?.contains(e.target) ||
        partDDRef.current?.contains(e.target);
      if (!inPart) setShowPartDD(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onScrollOrResize = () => {
      if (showPartDD) measureAndSetTop(partInputRef, setPartDDTop);
    };
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showPartDD]);

  // ===== FETCH: PARTS + REFURB (debounced) =====
  useEffect(() => {
    const q = (partQuery || "").trim();
    const brandOnly = hasBrandOnlyIntent(q);

    if (q.length < 2 && !brandOnly) {
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

    const t = setTimeout(async () => {
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
      clearTimeout(t);
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

  const inStockPartsOnly = visibleParts.filter(isInStock);

  const visiblePartsSorted = useMemo(() => {
    const base = inStockPartsOnly.length > 0 ? inStockPartsOnly : visibleParts;
    return base
      .slice()
      .sort((a, b) => {
        const ap = numericPrice(a);
        const bp = numericPrice(b);
        if (ap == null && bp == null) return 0;
        if (ap == null) return 1;
        if (bp == null) return -1;
        return bp - ap;
      });
  }, [inStockPartsOnly, visibleParts]);

  // fetch inventory counts for visible New Parts cards
  useEffect(() => {
    if (!showPartDD) return;
    if (!visiblePartsSorted || visiblePartsSorted.length === 0) return;

    let cancelled = false;
    const items = visiblePartsSorted.slice(0, MAX_PARTS);

    (async () => {
      await Promise.all(
        items.map(async (p) => {
          const mpn = getTrustedMPN(p);
          if (!mpn) return;
          if (Object.prototype.hasOwnProperty.call(partInvCounts, mpn)) return;

          const cnt = await fetchInventoryCount(mpn, DEFAULT_ZIP);
          if (cancelled) return;

          setPartInvCounts((prev) => {
            if (Object.prototype.hasOwnProperty.call(prev, mpn)) return prev;
            return { ...prev, [mpn]: cnt };
          });
        })
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPartDD, visiblePartsSorted, partInvCounts]);

  // fetch inventory counts for visible Refurb cards
  useEffect(() => {
    if (!showPartDD) return;
    if (!visibleRefurb || visibleRefurb.length === 0) return;

    let cancelled = false;
    const items = visibleRefurb.slice(0, MAX_REFURB);

    (async () => {
      await Promise.all(
        items.map(async (p) => {
          const mpn = getTrustedMPN(p);
          if (!mpn) return;
          if (Object.prototype.hasOwnProperty.call(refurbInvCounts, mpn)) return;

          const cnt = await fetchRefurbInventoryCount(mpn, DEFAULT_ZIP);
          if (cancelled) return;

          setRefurbInvCounts((prev) => {
            if (Object.prototype.hasOwnProperty.call(prev, mpn)) return prev;
            return { ...prev, [mpn]: cnt };
          });
        })
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPartDD, visibleRefurb, refurbInvCounts]);

  return (
    <div ref={partBoxRef} className="relative">
      <input
        ref={partInputRef}
        type="text"
        placeholder="Enter part number, brand, appliance or part type"
        className="w-[420px] max-w-[92vw] border-4 border-yellow-400 pr-4 pl-12 px-3 py-2 rounded text-black text-xs md:text-sm font-medium"
        value={partQuery}
        onChange={(e) => setPartQuery(e.target.value)}
        onFocus={() => {
          const q = partQuery.trim();
          if (q.length >= 2 || hasBrandOnlyIntent(q)) {
            setShowPartDD(true);
            measureAndSetTop(partInputRef, setPartDDTop);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && partQuery.trim()) openPart(partQuery.trim());
          if (e.key === "Escape") setShowPartDD(false);
        }}
      />

      {(loadingParts || loadingRefurb) &&
        (partQuery.trim().length >= 2 ||
          hasBrandOnlyIntent(partQuery.trim())) && (
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg
              className="animate-spin-clock h-5 w-5 text-gray-700"
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
          </div>
        )}

      {showPartDD && (
        <div
          ref={partDDRef}
          className="fixed left-1/2 -translate-x-1/2 bg-white text-black border rounded shadow-xl z-20 ring-1 ring-black/5"
          style={{ top: partDDTop, width: "min(96vw,1100px)" }}
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
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
                  <path d="M12 12 L12 5" />
                </svg>
                <span>Searching…</span>
              </div>
            )}

            {noPartResults && !loadingParts && !loadingRefurb ? (
              <div className="mt-2 text-sm text-gray-500 italic">
                We can&apos;t find that search term.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LEFT: Refurbished */}
                <div>
                  <div className="bg-emerald-500 text-white font-bold text-sm px-2 py-1 rounded inline-flex items-center gap-2">
                    <span>Refurbished</span>
                  </div>

                  <div className="mt-2 max-h-[300px] overflow-y-auto pr-1">
                    {visibleRefurb.length === 0 && !loadingRefurb ? (
                      <div className="text-sm text-gray-500 italic">
                        No refurbished parts found.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {visibleRefurb.slice(0, MAX_REFURB).map((p, idx) => {
                          const mpn = getTrustedMPN(p);
                          const offerCount = Number(
                            p?.refurb_count ??
                              p?.refurb_offers ??
                              p?.offer_count ??
                              0
                          );
                          const inv = mpn != null ? refurbInvCounts[mpn] : null;

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
                                      e.currentTarget.style.display = "none";
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

                                    <span className="inline-flex items-center rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                                      In stock
                                      {typeof inv === "number" &&
                                      Number.isFinite(inv)
                                        ? ` (${inv} available)`
                                        : Number.isFinite(offerCount) &&
                                          offerCount > 0
                                        ? ` (${offerCount} available)`
                                        : ""}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          );
                        })}

                        {refurbTotalCount > 0 && (
                          <div className="text-[12px] text-gray-600">
                            Showing{" "}
                            {Math.min(visibleRefurb.length, MAX_REFURB)} cards •{" "}
                            {refurbTotalCount} total offers
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
                        {visiblePartsSorted.slice(0, MAX_PARTS).map((p, idx) => {
                          const mpn = getTrustedMPN(p);
                          const inv = mpn != null ? partInvCounts[mpn] : null;

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
                                      e.currentTarget.style.display = "none";
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

                                    {(() => {
                                      // ✅ If Worker gave us a definitive number, trust it.
                                      if (
                                        typeof inv === "number" &&
                                        Number.isFinite(inv)
                                      ) {
                                        if (inv >= 1) {
                                          return (
                                            <span className="inline-flex items-center rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                                              In stock ({inv} available)
                                            </span>
                                          );
                                        }
                                        // inv === 0
                                        return (
                                          <span className="inline-flex items-center rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                                            Backorder (5–30 days)
                                          </span>
                                        );
                                      }

                                      // No Worker count (yet / failed): fall back to stock_status
                                      return renderStockBadge(p?.stock_status);
                                    })()}
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
  );
}
