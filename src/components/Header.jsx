// src/components/Header.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const MAX_MODELS = 5;
const MAX_PARTS = 5;
const MAX_REFURB = 5;

// TTL for compare cache (only positive results cached)
const CMP_TTL_MS = 5 * 60 * 1000; // 5 minutes

const Header = () => {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");

  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);

  const [modelPartsData, setModelPartsData] = useState({});
  const [brandLogos, setBrandLogos] = useState([]);

  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  // compare summaries state + cache
  const [compareSummaries, setCompareSummaries] = useState({}); // { mpn_norm: {price,url,totalQty,savings}|null }
  const compareCacheRef = useRef(new Map()); // Map<mpn_norm, {v: summary, t: timestampMs}>

  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const controllerRef = useRef(null);

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

    // reliable_sku no longer in backend; keep as harmless fallback
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

  const openPart = (mpn) => {
    if (!mpn) return;
    navigate(`/parts/${encodeURIComponent(mpn)}`);
    setQuery("");
    setShowDropdown(false);
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

  // ---------- close dropdown on outside click ----------
  useEffect(() => {
    const onClick = (e) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
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

  // ---------- query models + parts + refurbished (debounced, single pass) ----------
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setModelSuggestions([]);
      setPartSuggestions([]);
      setRefurbSuggestions([]);
      setModelPartsData({});
      setShowDropdown(false);
      controllerRef.current?.abort?.();
      return;
    }

    controllerRef.current?.abort?.();
    controllerRef.current = new AbortController();

    const t = setTimeout(() => {
      setLoadingModels(true);
      setLoadingParts(true);
      setLoadingRefurb(true);

      const params = { signal: controllerRef.current.signal };

      const reqModels = axios.get(
        `${API_BASE}/api/suggest?q=${encodeURIComponent(query)}&limit=10`,
        params
      );
      const reqParts = axios.get(
        `${API_BASE}/api/suggest/parts?q=${encodeURIComponent(query)}&limit=10`,
        params
      );
      const reqRefurb = axios.get(
        `${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(query)}&limit=10`,
        params
      );

      Promise.allSettled([reqModels, reqParts, reqRefurb])
        .then(([mRes, pRes, rRes]) => {
          // MODELS
          if (mRes.status === "fulfilled") {
            const data = mRes.value?.data || {};
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
          } else {
            setModelSuggestions([]);
            setModelPartsData({});
          }

          // PARTS (Reliable)
          if (pRes.status === "fulfilled") {
            const parsed = parseArrayish(pRes.value?.data);
            setPartSuggestions(parsed.slice(0, MAX_PARTS));
          } else {
            setPartSuggestions([]);
          }

          // REFURB (eBay) — show independently, do NOT dedupe against parts
          if (rRes.status === "fulfilled") {
            const parsed = parseArrayish(rRes.value?.data);
            setRefurbSuggestions(parsed.slice(0, MAX_REFURB));
          } else {
            setRefurbSuggestions([]);
          }

          setShowDropdown(true);
        })
        .finally(() => {
          setLoadingModels(false);
          setLoadingParts(false);
          setLoadingRefurb(false);
        });
    }, 250);

    return () => clearTimeout(t);
  }, [query]);

  // ---------- fetch compare summaries for top part suggestions ----------
  useEffect(() => {
    const top = (partSuggestions || []).slice(0, MAX_PARTS);
    if (!top.length) return;

    let canceled = false;

    (async () => {
      const updates = {};
      const tasks = [];
      const now = Date.now();

      for (const p of top) {
        const mpn = extractMPN(p);
        const key = normalize(mpn);
        if (!key) continue;

        // TTL cache: only cache positive results; never pin nulls
        const hit = compareCacheRef.current.get(key);
        if (hit && now - hit.t < CMP_TTL_MS) {
          updates[key] = hit.v; // summary object
          continue;
        }

        tasks.push(
          axios
            .get(`${API_BASE}/api/compare/xmarket/${encodeURIComponent(mpn)}?limit=1`, { timeout: 6000 })
            .then(({ data }) => {
              // prefer server "best"; fallback to first offer if best is null
              const offers = data?.refurb?.offers || [];
              const best = data?.refurb?.best || offers[0] || null;

              const totalQty = data?.refurb?.total_quantity ?? 0;

              const summary = best
                ? {
                    price: best.price ?? null,
                    url: best.url ?? null,
                    totalQty,
                    savings: data?.savings ?? null, // may be null if price missing
                  }
                : (totalQty > 0
                    ? { price: null, url: null, totalQty, savings: null } // signal: refurb exists even w/o parseable price
                    : null);

              // cache only positive results with timestamp; remove if null
              if (summary) {
                compareCacheRef.current.set(key, { v: summary, t: Date.now() });
              } else {
                compareCacheRef.current.delete(key);
              }
              updates[key] = summary;
            })
            .catch(() => {
              // do not cache failures; allow retry later
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
  }, [partSuggestions]);

  return (
    <header className="sticky top-0 z-50 bg-[#001F3F] text-white shadow">
      <div className="w-full px-4 md:px-6 lg:px-10 py-3 grid grid-cols-2 md:grid-cols-12 xl:grid-cols-12 gap-3 items-center">
        {/* Logo */}
        <div className="
          col-span-1 col-start-1 row-start-1
          md:col-start-1 md:col-span-3 md:row-start-1 md:row-span-2
          lg:col-start-1 lg:col-span-3 lg:row-start-1 lg:row-span-2
          xl:row-span-1 xl:row-start-1 xl:col-start-1 xl:col-span-2 xl:order-1
        ">
          <Link to="/" className="block">
            <img
              src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/output-onlinepngtools-3.webp"
              alt="Logo"
              className="h-10 md:h-12 lg:h-14 xl:h-16 object-contain"
            />
          </Link>
        </div>

        {/* Menu */}
        <div className="
          col-span-1 col-start-2 row-start-1 justify-self-end
          md:col-start-4 md:col-span-9 md:row-start-1
          lg:col-start-4 lg:col-span-9 lg:row-start-1
          xl:row-start-1 xl:col-start-7 xl:col-span-6 xl:order-3 xl:justify-self-end
          w-full lg:w-auto
        ">
          <HeaderMenu />
        </div>

        {/* Search */}
        <div className="
          col-span-2 col-start-1 row-start-2
          md:col-start-4 md:col-span-9 md:row-start-2
          lg:col-start-4 lg:col-span-9 lg:row-start-2
          xl:row-start-1 xl:col-start-3 xl:col-span-4 xl:order-2
          w-full min-w-0 relative desk:max-w-[560px]
        ">
          <input
            ref={searchRef}
            type="text"
            placeholder="Enter model or part number here"
            className="block w-full min-w-0 desk:max-w-[560px] border-4 border-yellow-400 px-3 py-2 rounded text-black text-sm md:text-base lg:text-lg font-medium"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query.trim().length >= 2) setShowDropdown(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                openPart(query.trim());
              }
              if (e.key === "Escape") {
                setShowDropdown(false);
              }
            }}
          />

          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 bg-white text-black border rounded shadow mt-2 p-4 z-10"
            >
              {(loadingModels || loadingParts || loadingRefurb) && (
                <div className="text-gray-600 text-sm flex items-center mb-4 gap-2">
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
                  Searching...
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Models */}
                <div>
                  <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
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
                                setQuery("");
                                setShowDropdown(false);
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

                {/* Parts (Reliable/new) */}
                <div>
                  <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                    Parts
                  </div>

                  {partSuggestions.length ? (
                    <ul className="divide-y">
                      {partSuggestions.map((p, i) => {
                        const mpn = extractMPN(p);
                        if (!mpn) return null;
                        const brandLogo = p?.brand && getBrandLogoUrl(p.brand);

                        // refurb compare pill data
                        const key = normalize(mpn);
                        const cmp = compareSummaries[key];

                        const showRefurb =
                          cmp && (cmp.price != null || (cmp.totalQty ?? 0) > 0);

                        return (
                          <li key={`p-${i}-${mpn}`} className="px-0 py-0">
                            <Link
                              to={routeForPart(p)}
                              className="block px-2 py-2 hover:bg-gray-100 text-sm rounded"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setQuery("");
                                setShowDropdown(false);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                {brandLogo && (
                                  <img
                                    src={brandLogo}
                                    alt={`${p.brand} logo`}
                                    className="w-10 h-6 object-contain"
                                  />
                                )}
                                <span className="font-medium line-clamp-1">
                                  {p?.name || mpn}
                                </span>
                              </div>

                              {/* bottom row: left = details, right = refurb pill */}
                              <div className="mt-1 flex items-center justify-between text-xs text-gray-500 gap-2">
                                <span className="min-w-0 truncate">
                                  MPN: {mpn}
                                  {formatPrice(p) ? ` | ${formatPrice(p)}` : ""}
                                  {p?.stock_status ? ` | ${p.stock_status}` : ""}
                                </span>

                                {/* refurb pill (price or at least "available") */}
                                {showRefurb && (
                                  <a
                                    href={cmp.url || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-3 text-[11px] rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700 whitespace-nowrap hover:bg-emerald-100"
                                    onClick={(e) => {
                                      if (!cmp.url) e.preventDefault();
                                    }}
                                    title={
                                      cmp.price != null
                                        ? (cmp.savings
                                            ? `Refurb from $${Number(cmp.price).toFixed(2)} • Save $${cmp.savings.amount} (${cmp.savings.percent}%)`
                                            : `Refurb from $${Number(cmp.price).toFixed(2)}`)
                                        : `Refurb available`
                                    }
                                  >
                                    {cmp.price != null
                                      ? `Refurb from $${Number(cmp.price).toFixed(2)}${cmp.savings ? ` • Save $${cmp.savings.amount} (${cmp.savings.percent}%)` : ""}`
                                      : `Refurb available`}
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

                {/* Refurbished (eBay) — shown independently; no dedupe */}
                <div>
                  <div className="bg-green-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                    Refurbished
                  </div>

                  {refurbSuggestions.length ? (
                    <ul className="divide-y">
                      {refurbSuggestions.map((p, i) => {
                        const mpn = extractMPN(p);
                        if (!mpn) return null;
                        return (
                          <li key={`r-${i}-${mpn}`} className="px-0 py-0">
                            <Link
                              to={routeForRefurb(p)}
                              className="block px-2 py-2 hover:bg-gray-100 text-sm rounded"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setQuery("");
                                setShowDropdown(false);
                              }}
                              title={p?.title || p?.name || mpn}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium line-clamp-1">
                                  {p?.title || p?.name || mpn}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                MPN: {mpn}
                                {formatPrice(p) ? ` | ${formatPrice(p)}` : ""}
                                {p?.seller_name ? ` | ${p?.seller_name}` : ""}
                                {p?.stock_status ? ` | ${p?.stock_status}` : ""}
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
    </header>
  );
};

export default Header;
