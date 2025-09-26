// src/components/Header.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const MAX_MODELS = 5;
const MAX_PARTS = 5;
const MAX_REFURB = 5;

const Header = () => {
  const navigate = useNavigate();

  // --- Queries (split) ---
  const [modelQuery, setModelQuery] = useState("");
  const [partQuery, setPartQuery] = useState("");

  // --- Suggestions ---
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [modelPartsData, setModelPartsData] = useState({});

  const [partSuggestions, setPartSuggestions] = useState([]);
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);

  // --- Logos ---
  const [brandLogos, setBrandLogos] = useState([]);

  // --- UI state ---
  const [showModelDD, setShowModelDD] = useState(false);
  const [showPartDD, setShowPartDD] = useState(false);

  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  // --- Compare (refurb badge) cache/state ---
  const [compareSummaries, setCompareSummaries] = useState({});
  const compareCacheRef = useRef(new Map());

  // --- Refs for outside-click & abort ---
  const modelBoxRef = useRef(null);
  const modelDDRef = useRef(null);
  const partBoxRef = useRef(null);
  const partDDRef = useRef(null);

  const modelControllerRef = useRef(null);
  const partControllerRef = useRef(null);

  // --- Parts dropdown viewport-centering (compute top) ---
  const [partDDTop, setPartDDTop] = useState(null);

  // ---------- helpers ----------
  const normalize = (s) => s?.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();

  const getBrandLogoUrl = (brand) => {
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || null;
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

  const formatPrice = (p) => {
    const price =
      p?.price_num ??
      p?.price_numeric ??
      (typeof p?.price === "number"
        ? p.price
        : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
    if (!price || Number.isNaN(price)) return "";
    const curr = (p?.currency || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: curr,
        maximumFractionDigits: 2,
      }).format(price);
    } catch {
      return `$${Number(price).toFixed(2)}`;
    }
  };

  const numPrice = (p) => {
    const price =
      p?.price_num ??
      p?.price_numeric ??
      (typeof p?.price === "number"
        ? p.price
        : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
    return Number.isFinite(Number(price)) ? Number(price) : null;
  };

  const isTrulyUnavailableNew = (p) => {
    const price = numPrice(p);
    const stock = (p?.stock_status || "").toLowerCase();
    const discontinued = /(discontinued|nla|no\s+longer\s+available|reference)/i.test(stock);
    return (price == null || price <= 0) && discontinued;
  };

  const isTrulyUnavailableRefurb = (p) => {
    const price = numPrice(p);
    const qty = Number(p?.quantity_available ?? p?.quantity ?? 0);
    const stock = (p?.stock_status || "").toLowerCase();
    const outish = /(out\s*of\s*stock|ended|unavailable)/i.test(stock);
    return (price == null || price <= 0) && (qty <= 0 || outish);
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

  // ---------- close dropdowns on outside click ----------
  useEffect(() => {
    const onClick = (e) => {
      const mb = modelBoxRef.current;
      const md = modelDDRef.current;
      const pb = partBoxRef.current;
      const pd = partDDRef.current;
      const insideModel = mb && mb.contains(e.target);
      const insideModelDD = md && md.contains(e.target);
      const insidePart = pb && pb.contains(e.target);
      const insidePartDD = pd && pd.contains(e.target);

      if (!insideModel && !insideModelDD) setShowModelDD(false);
      if (!insidePart && !insidePartDD) setShowPartDD(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ---------- prefetch brand logos ----------
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/brand-logos`)
      .then((r) => setBrandLogos(r.data || []))
      .catch(() => {});
  }, []);

  // ---------- MODEL search effect ----------
  useEffect(() => {
    if (!modelQuery || modelQuery.trim().length < 2) {
      setModelSuggestions([]);
      setModelPartsData({});
      setShowModelDD(false);
      modelControllerRef.current?.abort?.();
      return;
    }

    modelControllerRef.current?.abort?.();
    modelControllerRef.current = new AbortController();

    const t = setTimeout(() => {
      setLoadingModels(true);

      axios
        .get(
          `${API_BASE}/api/suggest?q=${encodeURIComponent(modelQuery)}&limit=10`,
          { signal: modelControllerRef.current.signal }
        )
        .then((res) => {
          const data = res?.data || {};
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
        })
        .catch(() => {
          setModelSuggestions([]);
          setModelPartsData({});
        })
        .finally(() => setLoadingModels(false));
    }, 250);

    return () => clearTimeout(t);
  }, [modelQuery]);

  // ---------- PART/REFURB search effect ----------
  useEffect(() => {
    if (!partQuery || partQuery.trim().length < 2) {
      setPartSuggestions([]);
      setRefurbSuggestions([]);
      setShowPartDD(false);
      partControllerRef.current?.abort?.();
      return;
    }

    partControllerRef.current?.abort?.();
    partControllerRef.current = new AbortController();

    const t = setTimeout(() => {
      setLoadingParts(true);
      setLoadingRefurb(true);

      const params = { signal: partControllerRef.current.signal };

      const reqParts = axios.get(
        `${API_BASE}/api/suggest/parts?q=${encodeURIComponent(partQuery)}&limit=10`,
        params
      );
      const reqRefurb = axios.get(
        `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(partQuery)}&limit=10`,
        params
      );

      Promise.allSettled([reqParts, reqRefurb])
        .then(([pRes, rRes]) => {
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
        })
        .finally(() => {
          setLoadingParts(false);
          setLoadingRefurb(false);
        });
    }, 250);

    return () => clearTimeout(t);
  }, [partQuery]);

  // ---------- fetch compare summaries ----------
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
            .get(
              `${API_BASE}/api/compare/xmarket/${encodeURIComponent(mpn)}?limit=1`,
              { timeout: 6000 }
            )
            .then(({ data }) => {
              const best = data?.refurb?.best;
              const summary = best
                ? {
                    price: best.price ?? null,
                    url: best.url ?? null,
                    totalQty: data?.refurb?.total_quantity ?? 0,
                    savings: data?.savings ?? null,
                  }
                : null;

              compareCacheRef.current.set(key, summary);
              updates[key] = summary;
            })
            .catch(() => {
              compareCacheRef.current.set(key, null);
              updates[key] = null;
            })
        );
      }

      if (!tasks.length) {
        if (!canceled && Object.keys(updates).length) {
          setCompareSummaries((prev) => ({ ...prev, ...updates }));
        }
        return;
      }

      await Promise.all(tasks);
      if (!canceled) {
        setCompareSummaries((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      canceled = true;
    };
  }, [partSuggestions, refurbSuggestions]);

  // ---------- center PART dropdown to viewport (compute top on open/resize/scroll) ----------
  useEffect(() => {
    const computeTop = () => {
      if (!showPartDD || !partBoxRef.current) return;
      const rect = partBoxRef.current.getBoundingClientRect();
      setPartDDTop(rect.bottom + window.scrollY + 8); // 8px gap
    };

    computeTop();
    if (!showPartDD) return;

    const onScroll = () => computeTop();
    const onResize = () => computeTop();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [showPartDD]);

  // derived visible lists after filtering “truly unavailable”
  const visibleParts = partSuggestions.filter((p) => !isTrulyUnavailableNew(p));
  const visibleRefurb = refurbSuggestions.filter((p) => !isTrulyUnavailableRefurb(p));

  return (
    <header className="sticky top-0 z-50 bg-[#001F3F] text-white shadow">
      <div className="w-full px-4 md:px-6 lg:px-10 py-3 grid grid-cols-12 gap-3">
        {/* Logo column spans both rows */}
        <div className="col-span-4 md:col-span-3 lg:col-span-2 row-span-2 self-stretch flex items-center">
          <Link to="/" className="block h-full flex items-center">
            <img
              src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/output-onlinepngtools-3.webp"
              alt="Logo"
              className="h-12 md:h-[72px] lg:h-[84px] object-contain"
            />
          </Link>
        </div>

        {/* Row 1 (right side): Menu bar */}
        <div className="col-span-8 md:col-span-9 lg:col-span-10 flex items-center justify-end">
          <HeaderMenu />
        </div>

        {/* Row 2 (right side): TWO compact inputs */}
        <div className="col-span-12 md:col-span-9 lg:col-span-10 md:col-start-4 lg:col-start-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* --- Models input --- */}
          <div className="relative" ref={modelBoxRef}>
            <input
              type="text"
              placeholder="Search models"
              className="block w-full max-w-[420px] border-4 border-yellow-400 px-3 py-2 rounded text-black text-sm md:text-base font-medium"
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
              onFocus={() => {
                if (modelQuery.trim().length >= 2) setShowModelDD(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowModelDD(false);
              }}
            />

            {showModelDD && (
              <div
                ref={modelDDRef}
                className="absolute left-1/2 -translate-x-1/2 w-[min(96vw,1100px)] bg-white text-black border rounded shadow-xl mt-2 z-20 ring-1 ring-black/5"
              >
                {(loadingModels) && (
                  <div className="text-gray-600 text-sm flex items-center gap-2 px-4 pt-4">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
                    </svg>
                    Searching models...
                  </div>
                )}

                <div className="p-4">
                  <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2 inline-block">
                    Models
                  </div>

                  {modelSuggestions.length ? (
                    <ul className="divide-y">
                      {modelSuggestions.slice(0, MAX_MODELS).map((m, i) => {
                        const s = modelPartsData[m.model_number] || { total: 0, priced: 0 };
                        return (
                          <li key={`mp-${i}`}>
                            <Link
                              to={`/model?model=${encodeURIComponent(m.model_number)}`}
                              className="block px-2 py-2 hover:bg-gray-100 text-sm rounded"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setModelQuery("");
                                setShowModelDD(false);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                {getBrandLogoUrl(m.brand) && (
                                  <img
                                    src={getBrandLogoUrl(m.brand)}
                                    alt={`${m.brand} logo`}
                                    className="w-16 h-6 object-contain"
                                  />
                                )}
                                <span className="font-medium">{m.model_number}</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {m.appliance_type} | Priced: {s.priced} / Total: {s.total}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    !loadingModels && (
                      <div className="text-sm text-gray-500 italic">No model matches found.</div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* --- Parts input (Reliable + Refurb), dropdown centered to viewport --- */}
          <div className="relative" ref={partBoxRef}>
            <input
              type="text"
              placeholder="Search parts / MPN"
              className="block w-full max-w-[420px] border-4 border-yellow-400 px-3 py-2 rounded text-black text-sm md:text-base font-medium"
              value={partQuery}
              onChange={(e) => setPartQuery(e.target.value)}
              onFocus={() => {
                if (partQuery.trim().length >= 2) setShowPartDD(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && partQuery.trim()) openPart(partQuery.trim());
                if (e.key === "Escape") setShowPartDD(false);
              }}
            />

            {showPartDD && partDDTop != null && (
              <div
                ref={partDDRef}
                style={{ top: partDDTop }}
                className="fixed left-1/2 -translate-x-1/2 w-[min(96vw,1100px)] bg-white text-black border rounded shadow-xl z-20 ring-1 ring-black/5"
              >
                {(loadingParts || loadingRefurb) && (
                  <div className="text-gray-600 text-sm flex items-center gap-2 px-4 pt-4">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
                    </svg>
                    Searching parts...
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                  {/* Parts (Reliable/new) */}
                  <div>
                    <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                      Parts
                    </div>

                    {partSuggestions.filter((p) => !isTrulyUnavailableNew(p)).length ? (
                      <ul className="divide-y">
                        {partSuggestions
                          .filter((p) => !isTrulyUnavailableNew(p))
                          .slice(0, MAX_PARTS)
                          .map((p, i) => {
                            const mpn = extractMPN(p);
                            if (!mpn) return null;
                            const brandLogo = p?.brand && getBrandLogoUrl(p.brand);

                            const key = normalize(mpn);
                            const cmp = compareSummaries[key];
                            const priceLabel = formatPrice(p);

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
                                  {/* Top line: Logo (larger) + raw MPN + appliance type */}
                                  <div className="flex items-center gap-2">
                                    {brandLogo && (
                                      <img
                                        src={brandLogo}
                                        alt={`${p.brand} logo`}
                                        className="w-20 h-10 object-contain"
                                      />
                                    )}
                                    <span className="font-semibold">{mpn}</span>
                                    {p?.appliance_type && (
                                      <span className="text-xs text-gray-500 truncate">
                                        {p.appliance_type}
                                      </span>
                                    )}
                                  </div>

                                  {/* Second line: stock + green price + refurb banner */}
                                  <div className="mt-1 flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600 truncate">
                                      {p?.stock_status ? `${p.stock_status}` : ""}
                                    </span>

                                    <span className="text-xs font-semibold text-green-700">
                                      {priceLabel}
                                    </span>

                                    {cmp && cmp.price != null && (
                                      <a
                                        href={cmp.url || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-3 text-[11px] rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700 whitespace-nowrap hover:bg-emerald-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!cmp.url) e.preventDefault();
                                        }}
                                        title={
                                          cmp.savings && cmp.savings.amount != null
                                            ? `Refurbished available for $${Number(
                                                cmp.price
                                              ).toFixed(2)} (Save $${cmp.savings.amount})`
                                            : `Refurbished available for $${Number(
                                                cmp.price
                                              ).toFixed(2)}`
                                        }
                                      >
                                        {`Refurbished available for $${Number(cmp.price).toFixed(2)}`}
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
                        <div className="text-sm text-gray-500 italic">No part matches found.</div>
                      )
                    )}
                  </div>

                  {/* Refurbished (eBay) */}
                  <div>
                    <div className="bg-green-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                      Refurbished
                    </div>

                    {refurbSuggestions.filter((p) => !isTrulyUnavailableRefurb(p)).length ? (
                      <ul className="divide-y">
                        {refurbSuggestions
                          .filter((p) => !isTrulyUnavailableRefurb(p))
                          .slice(0, MAX_REFURB)
                          .map((p, i) => {
                            const mpn = extractMPN(p);
                            if (!mpn) return null;

                            const key = normalize(mpn);
                            const cmp = compareSummaries[key];
                            const refurbPriceLabel = formatPrice(p);

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
                                  {/* Top line: raw MPN (seller hidden) */}
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{mpn}</span>
                                  </div>

                                  {/* Second line: stock + green price + short banner */}
                                  <div className="mt-1 flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600 truncate">
                                      {p?.stock_status ? `${p.stock_status}` : ""}
                                    </span>

                                    <span className="text-xs font-semibold text-green-700">
                                      {refurbPriceLabel}
                                    </span>

                                    {cmp && cmp.price != null && (
                                      <span
                                        className="ml-3 text-[11px] rounded px-1.5 py-0.5 bg-sky-50 text-sky-700 whitespace-nowrap"
                                        title={
                                          cmp.savings && cmp.savings.amount != null
                                            ? `Refurbished available for $${Number(
                                                cmp.price
                                              ).toFixed(2)} (Save $${cmp.savings.amount})`
                                            : `Refurbished available for $${Number(
                                                cmp.price
                                              ).toFixed(2)}`
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {`Refurbished available for $${Number(cmp.price).toFixed(2)}`}
                                        {cmp.savings && cmp.savings.amount != null
                                          ? ` (Save $${cmp.savings.amount})`
                                          : ""}
                                      </span>
                                    )}
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
    </header>
  );
};

export default Header;

