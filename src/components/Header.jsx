// src/components/Header.jsx
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const Header = () => {
  const [query, setQuery] = useState("");
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [modelPartsData, setModelPartsData] = useState({});
  const [brandLogos, setBrandLogos] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);

  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const controllerRef = useRef(null);

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

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/brand-logos`)
      .then((r) => setBrandLogos(r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setModelSuggestions([]);
      setPartSuggestions([]);
      setModelPartsData({});
      return;
    }
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    const t = setTimeout(() => {
      setLoadingModels(true);
      setLoadingParts(true);

      axios
        .get(`${API_BASE}/api/suggest?q=${encodeURIComponent(query)}`, {
          signal: controllerRef.current.signal,
        })
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
          setModelSuggestions(models);
          setModelPartsData(stats);
        })
        .catch(() => {
          setModelSuggestions([]);
          setModelPartsData({});
        })
        .finally(() => setLoadingModels(false));

      axios
        .get(`${API_BASE}/api/suggest/parts?q=${encodeURIComponent(query)}`, {
          signal: controllerRef.current.signal,
        })
        .then((res) => setPartSuggestions(res.data || []))
        .catch(() => setPartSuggestions([]))
        .finally(() => setLoadingParts(false));

      setShowDropdown(true);
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  const normalize = (s) => s?.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
  const getBrandLogoUrl = (brand) => {
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || null;
  };

  return (
    <header className="sticky top-0 z-50 bg-[#001F3F] text-white shadow">
      {/* MOBILE: 1 col (Logo, Search, Menu) 
          PAD (md): 12-col grid with 2 rows → Logo left spanning 2 rows; Menu top-right; Search bottom-right
          LAPTOP+ (lg): 12-col single row → Logo | Search | Menu */}
      <div className="w-full px-4 md:px-6 lg:px-10 py-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* LOGO — big, left; spans two rows on pad; normal on lg+ */}
        <div className="order-1 md:col-span-3 md:row-span-2 md:self-center lg:row-span-1 lg:col-span-2">
          <Link to="/" className="block">
            <img
              src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/output-onlinepngtools-3.webp"
              alt="Logo"
              className="h-10 md:h-12 lg:h-14 xl:h-16 object-contain"
            />
          </Link>
        </div>

        {/* MENU — on pad sits ABOVE search at right; on mobile it’s last; on lg+ moves to right end */}
        <div className="order-3 md:order-2 md:col-span-9 md:row-start-1 lg:order-none lg:row-auto lg:col-span-3 xl:col-span-2 w-full lg:w-auto justify-self-start lg:justify-self-end overflow-x-auto">
          <HeaderMenu />
        </div>

        {/* SEARCH — full width on mobile; on pad under the menu at right; on lg+ centered lane */}
        <div className="order-2 md:order-3 md:col-span-9 md:row-start-2 lg:order-none lg:row-auto lg:col-span-7 xl:col-span-8 w-full min-w-0 relative">
          <input
            ref={searchRef}
            type="text"
            placeholder="Enter model or part number here"
            className="block w-full min-w-0 border-4 border-yellow-400 px-3 py-2 rounded text-black text-sm md:text-base lg:text-lg font-medium"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 bg-white text-black border rounded shadow mt-2 p-4 z-10"
            >
              {(loadingModels || loadingParts) && (
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
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Searching...
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Models */}
                <div>
                  <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                    Models
                  </div>
                  {modelSuggestions.length ? (
                    <>
                      {modelSuggestions
                        .filter((m) => m.priced_parts > 0)
                        .map((m, idx) => {
                          const s =
                            modelPartsData[m.model_number] || {
                              total: 0,
                              priced: 0,
                            };
                          return (
                            <Link
                              key={`model-priced-${idx}`}
                              to={`/model?model=${encodeURIComponent(
                                m.model_number
                              )}`}
                              className="block px-2 py-2 hover:bg-gray-100 text-sm rounded"
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
                          );
                        })}

                      {modelSuggestions.some((m) => m.priced_parts === 0) && (
                        <div className="mt-4 font-semibold text-gray-600 text-sm uppercase">
                          Model Information (no available parts)
                        </div>
                      )}

                      {modelSuggestions
                        .filter((m) => m.priced_parts === 0)
                        .map((m, idx) => (
                          <Link
                            key={`model-unpriced-${idx}`}
                            to={`/model?model=${encodeURIComponent(
                              m.model_number
                            )}`}
                            className="block px-2 py-2 hover:bg-gray-100 text-sm rounded"
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
                            <div className="text-xs text-gray-500 italic">
                              {m.appliance_type} — No available parts
                            </div>
                          </Link>
                        ))}
                    </>
                  ) : (
                    !loadingModels && (
                      <div className="text-sm text-gray-500 italic">
                        No model matches found.
                      </div>
                    )
                  )}
                </div>

                {/* Parts */}
                <div>
                  <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                    Parts
                  </div>
                  {partSuggestions.length ? (
                    partSuggestions.map((p, idx) => (
                      <Link
                        key={`part-${idx}`}
                        to={`/parts/${encodeURIComponent(p.mpn)}`}
                        className="block px-2 py-2 hover:bg-gray-100 text-sm rounded"
                        onClick={() => {
                          setQuery("");
                          setShowDropdown(false);
                        }}
                      >
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">MPN: {p.mpn}</div>
                      </Link>
                    ))
                  ) : (
                    !loadingParts && (
                      <div className="text-sm text-gray-500 italic">
                        No part matches found.
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
