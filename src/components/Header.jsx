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

  const getMPN = (p) =>
    p?.mpn ||
    p?.MPN ||
    p?.part_number ||
    p?.partNumber ||
    p?.id ||
    p?.listing_mpn ||
    "";

  const priceStr = (p) => {
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
    navigate(`/parts/${encodeURIComponent(mpn)}`); // backend resolves canonical/offer
    setQuery("");
    setShowDropdown(false);
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

  // ---------- query models + parts + refurbished (debounced) ----------
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

      // MODELS
      axios
        .get(
          `${API_BASE}/api/suggest?q=${encodeURIComponent(query)}&limit=10`,
          { signal: controllerRef.current.signal }
        )
        .then((res) => {
          const withP = res.data?.with_priced_parts || [];
          const noP = res.data?.without_priced_parts || [];
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
        })
        .catch(() => {
          setModelSuggestions([]);
          setModelPartsData({});
        })
        .finally(() => setLoadingModels(false));

      // NEW PARTS
      axios
        .get(
          `${API_BASE}/api/suggest/parts?q=${encodeURIComponent(
            query
          )}&limit=10`,
          { signal: controllerRef.current.signal }
        )
        .then((res) => {
          const parsed = parseArrayish(res?.data);
          const seen = new Set();
          const deduped = [];
          for (const p of parsed) {
            const mpn = normalize(getMPN(p));
            if (!mpn || seen.has(mpn)) continue;
            seen.add(mpn);
            deduped.push(p);
          }
          setPartSuggestions(deduped.slice(0, MAX_PARTS));
        })
        .catch(() => setPartSuggestions([]))
        .finally(() => setLoadingParts(false));

      // REFURBISHED
      axios
        .get(
          `${API_BASE}/api/suggest/refurbished?q=${encodeURIComponent(
            query
          )}&limit=10`,
          { signal: controllerRef.current.signal }
        )
        .then((res) => {
          const parsed = parseArrayish(res?.data);
          const seenNew = new Set(
            (partSuggestions || []).map((p) => normalize(getMPN(p)))
          );
          const seen = new Set();
          const deduped = [];
          for (const p of parsed) {
            const mpn = normalize(getMPN(p));
            if (!mpn || seen.has(mpn) || seenNew.has(mpn)) continue; // hide dupes already in "Parts"
            seen.add(mpn);
            deduped.push(p);
          }
          setRefurbSuggestions(deduped.slice(0, MAX_REFURB));
        })
        .catch(() => setRefurbSuggestions([]))
        .finally(() => setLoadingRefurb(false));

      setShowDropdown(true);
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

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
                // Jump straight to the resolver-backed part page
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
                    <>
                      {modelSuggestions
                        .filter((m) => (m.priced_parts ?? 0) > 0)
                        .map((m, i) => {
                          const s = modelPartsData[m.model_number] || {
                            total: 0,
                            priced: 0,
                          };
                          return (
                            <Link
                              key={`mp-${i}`}
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
                          );
                        })}

                      {modelSuggestions.some((m) => (m.priced_parts ?? 0) === 0) && (
                        <div className="mt-4 font-semibold text-gray-600 text-sm uppercase">
                          Model Information (no available parts)
                        </div>
                      )}

                      {modelSuggestions
                        .filter((m) => (m.priced_parts ?? 0) === 0)
                        .map((m, i) => (
                          <Link
                            key={`mu-${i}`}
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
                            <div className="text-xs text-gray-500 italic">
                              {m.appliance_type} — No available parts
                            </div>
                          </Link>
                        ))}
                    </>
                  ) : (
                    !loadingModels && (
                      <div className="text-sm text-gray-500 italic">No model matches found.</div>
                    )
                  )}
                </div>

                {/* New Parts */}
                <div>
                  <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                    Parts
                  </div>

                  {partSuggestions.length ? (
                    <ul className="divide-y">
                      {partSuggestions.map((p, i) => {
                        const mpn = getMPN(p);
                        if (!mpn) return null;
                        const brandLogo = p?.brand && getBrandLogoUrl(p.brand);

                        return (
                          <li
                            key={`p-${i}-${mpn}`}
                            className="px-2 py-2 hover:bg-gray-100 text-sm rounded cursor-pointer"
                            title={mpn}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              openPart(mpn);
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
                            <div className="text-xs text-gray-500">
                              MPN: {mpn}
                              {priceStr(p) ? ` | ${priceStr(p)}` : ""}
                              {p?.stock_status ? ` | ${p.stock_status}` : ""}
                            </div>
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

                {/* Refurbished */}
                <div>
                  <div className="bg-green-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                    Refurbished
                  </div>

                  {refurbSuggestions.length ? (
                    <ul className="divide-y">
                      {refurbSuggestions.map((p, i) => {
                        const mpn = getMPN(p);
                        if (!mpn) return null;
                        return (
                          <li
                            key={`r-${i}-${mpn}`}
                            className="px-2 py-2 hover:bg-gray-100 text-sm rounded cursor-pointer"
                            title={p?.title || p?.name || mpn}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              openPart(mpn);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium line-clamp-1">
                                {p?.title || p?.name || mpn}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              MPN: {mpn}
                              {priceStr(p) ? ` | ${priceStr(p)}` : ""}
                              {p?.seller_name ? ` | ${p.seller_name}` : ""}
                              {p?.stock_status ? ` | ${p.stock_status}` : ""}
                            </div>
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


