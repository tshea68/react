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

  // query & suggestions
  const [query, setQuery] = useState("");
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);

  // misc data
  const [modelPartsData, setModelPartsData] = useState({});
  const [brandLogos, setBrandLogos] = useState([]);

  // UI state
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  // compare pill cache/state
  const [compareSummaries, setCompareSummaries] = useState({}); // { mpn_norm: {...} | null }
  const compareCacheRef = useRef(new Map());

  // refs
  const searchBoxRef = useRef(null);
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

    // (legacy harmless fallback)
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

  // Hide truly unavailable (NEW) parts in the dropdown:
  // only hide if (no/zero price) AND stock looks discontinued/NLA/reference
  const isTrulyUnavailableNew = (p) => {
    const price = numPrice(p);
    const stock = (p?.stock_status || "").toLowerCase();
    const discontinued = /(discontinued|nla|no\s+longer\s+available|reference)/i.test(stock);
    return (price == null || price <= 0) && discontinued;
  };

  // Hide truly unavailable refurb in the dropdown:
  // only hide if (no/zero price) AND (qty <= 0 OR stock says out/ended/unavailable)
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
      const box = searchBoxRef.current;
      const dd = dropdownRef.current;
      if (box && !box.contains(e.target) && dd && !dd.contains(e.target)) {
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

  // ---------- fetch compare summaries for top part + refurb suggestions ----------
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
              const reliable = data?.reliable || null;
              const summary = best
                ? {
                    // refurb side
                    price: best.price ?? null,
                    url: best.url ?? null,
                    totalQty: data?.refurb?.total_quantity ?? 0,
                    savings: data?.savings ?? null, // {amount, percent} or null
                    // NEW side (for refurb cards)
                    reliablePrice: reliable?.price ?? null,
                    reliableStock: (reliable?.stock_status || "").toLowerCase(),
                  }
                : reliable
                ? {
                    price: null,
                    url: null,
                    totalQty: 0,
                    savings: null,
                    reliablePrice: reliable?.price ?? null,
                    reliableStock: (reliable?.stock_status || "").toLowerCase(),
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

        {/* Row 2 (right side): Full-width search bar */}
        <div
          className="col-span-12 md:col-start-4 md:col-span-9 lg:col-start-3 lg:col-span-10 relative"
          ref={searchBoxRef}
        >
          <input
            type="text"
            placeholder="Enter model or part number here"
            className="block w-full border-4 border-yellow-400 px-3 py-2 rounded text-black text-sm md:text-base lg:text-lg font-medium"
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
              className="absolute left-0 right-0 bg-white text-black border rounded shadow mt-2 p-4 z-20"
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
                        const s =
                          modelPartsData[m.model_number] || {
                            total: 0,
                            priced: 0,
                          };
                        return (
                          <li key={`mp-${i}`}>
                            <Link
                              to={`/model?model=${encodeURIComponent(
                                m.model_number
                              )}`}
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
                                <span className="font-medium">
                                  {m.model_number}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {m.appliance_type} | Priced: {s.priced} / Total:{" "}
                                {s.total}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    !loadingModels && (
                      <div className="text-sm text-gray-500 italic">
                        No model matches found.
                      </div>
                    )
                  )}
                </div>

                {/* Parts (Reliable/new) */}
                <div>
                  <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                    Parts
                  </div>

                  {visibleParts.length ? (
                    <ul className="divide-y">
                      {visibleParts.map((p, i) => {
                        const mpn = extractMPN(p);
                        if (!mpn) return null;
                        const brandLogo = p?.brand && getBrandLogoUrl(p.brand);

                        // refurb compare pill data
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
                                setQuery("");
                                setShowDropdown(false);
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

                              {/* Second line: stock + green price + refurb badge */}
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
                      <div className="text-sm text-gray-500 italic">
                        No part matches found.
                      </div>
                    )
                  )}
                </div>

                {/* Refurbished (eBay) — shown independently; no dedupe */}
                <div>
                  <div className="bg-green-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                    Refurbished
                  </div>

                  {visibleRefurb.length ? (
                    <ul className="divide-y">
                      {visibleRefurb.map((p, i) => {
                        const mpn = extractMPN(p);
                        if (!mpn) return null;

                        const key = normalize(mpn);
                        const cmp = compareSummaries[key]; // now carries reliablePrice & reliableStock too
                        const refurbPrice = numPrice(p);
                        const refurbPriceLabel = formatPrice(p);

                        // Compose NEW badge text for refurb cards
                        let newBadge = null;
                        if (cmp) {
                          const newPrice = cmp.reliablePrice;
                          const stock = cmp.reliableStock || "";
                          if (newPrice != null) {
                            const delta = newPrice - (refurbPrice ?? newPrice);
                            const more = delta >= 0;
                            const deltaAbs = Math.abs(delta).toFixed(2);
                            const deltaSpan = (
                              <span className={more ? "text-red-600 font-semibold" : ""}>
                                {more ? `$${deltaAbs} more` : `$${deltaAbs} less`}
                              </span>
                            );

                            if (/special/.test(stock)) {
                              newBadge = (
                                <>
                                  New Part is Only Available Special Order for ${newPrice.toFixed(2)} (
                                  {deltaSpan})
                                </>
                              );
                            } else if (/in\s*stock/.test(stock)) {
                              newBadge = (
                                <>
                                  New Part Available for ${newPrice.toFixed(2)} ({deltaSpan})
                                </>
                              );
                            } else {
                              // priced but unclear stock wording
                              newBadge = (
                                <>
                                  New Part Available for ${newPrice.toFixed(2)} ({deltaSpan})
                                </>
                              );
                            }
                          } else {
                            newBadge = <>New Part Not Available</>;
                          }
                        }

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
                              {/* Top line: raw MPN only (seller hidden) */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{mpn}</span>
                              </div>

                              {/* Second line: stock + green price + NEW badge */}
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="text-xs text-gray-600 truncate">
                                  {p?.stock_status ? `${p.stock_status}` : ""}
                                </span>

                                <span className="text-xs font-semibold text-green-700">
                                  {refurbPriceLabel}
                                </span>

                                {newBadge && (
                                  <span
                                    className="ml-3 text-[11px] rounded px-1.5 py-0.5 bg-sky-50 text-sky-700 whitespace-nowrap"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {newBadge}
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
    </header>
  );
};

export default Header;

