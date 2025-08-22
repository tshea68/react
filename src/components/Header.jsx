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
    const handleClickOutside = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchBrandLogos = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/brand-logos`);
        setBrandLogos(res.data);
      } catch (err) {
        console.error("❌ Error fetching brand logos:", err);
      }
    };
    fetchBrandLogos();
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

    const debounce = setTimeout(() => {
      setLoadingModels(true);
      setLoadingParts(true);

      axios
        .get(`${API_BASE}/api/suggest?q=${query}`, {
          signal: controllerRef.current.signal,
        })
        .then((modelRes) => {
          const withPriced = modelRes.data?.with_priced_parts || [];
          const withoutPriced = modelRes.data?.without_priced_parts || [];
          const combinedModels = [...withPriced, ...withoutPriced];

          const statsMap = {};
          for (const m of combinedModels) {
            statsMap[m.model_number] = {
              total: m.total_parts ?? 0,
              priced: m.priced_parts ?? 0,
            };
          }

          setModelSuggestions(combinedModels);
          setModelPartsData(statsMap);
          setLoadingModels(false);
          setShowDropdown(true);
        })
        .catch((err) => {
          if (!axios.isCancel(err)) {
            console.error("❌ Model suggestion fetch failed:", err);
            setModelSuggestions([]);
            setModelPartsData({});
            setLoadingModels(false);
          }
        });

      axios
        .get(`${API_BASE}/api/suggest/parts?q=${query}`, {
          signal: controllerRef.current.signal,
        })
        .then((partRes) => {
          setPartSuggestions(partRes.data || []);
          setLoadingParts(false);
          setShowDropdown(true);
        })
        .catch((err) => {
          if (!axios.isCancel(err)) {
            console.error("❌ Part suggestion fetch failed:", err);
            setPartSuggestions([]);
            setLoadingParts(false);
          }
        });
    }, 300);

    return () => clearTimeout(debounce);
  }, [query]);

  const normalize = (str) =>
    str?.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();

  const getBrandLogoUrl = (brand) => {
    const brandKey = normalize(brand);
    const match = brandLogos.find((b) => normalize(b.name) === brandKey);
    return match?.image_url || null;
  };

  return (
    <header className="sticky top-0 z-50 bg-[#001F3F] shadow text-white">
      {/* ONE ROW: logo (30%) | search (60%) | menu (10%) */}
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Logo container (+10%) */}
        <div className="shrink-0 flex items-center basis-[30%]">
          <Link to="/">
            <img
              src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/output-onlinepngtools-3.webp"
              alt="Logo"
              className="h-14 md:h-16 object-contain"
            />
          </Link>
        </div>

        {/* Search container (-10%) */}
        <div className="relative basis-[60%]">
          <input
            ref={searchRef}
            type="text"
            placeholder="Enter model or part number here"
            className="border-4 border-yellow-400 px-4 py-2 rounded w-full text-black text-base md:text-lg font-medium"
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
                  <svg className="animate-spin h-4 w-4 text-gray-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Searching...
                </div>
              )}

              {/* suggestions unchanged */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Models */}
                <div>
                  <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded mb-2">
                    Models
                  </div>
                  {modelSuggestions.length > 0 ? (
                    <>
                      {modelSuggestions.filter((m) => m.priced_parts > 0).map((m, idx) => {
                        const stats = modelPartsData[m.model_number] || { total: 0, priced: 0 };
                        return (
                          <Link
                            key={`model-priced-${idx}`}
                            to={`/model?model=${encodeURIComponent(m.model_number)}`}
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
                              <span className="font-medium">{m.model_number}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {m.appliance_type} | Priced: {stats.priced} / Total: {stats.total}
                            </div>
                          </Link>
                        );
                      })}

                      {modelSuggestions.some((m) => m.priced_parts === 0) && (
                        <div className="mt-4 font-semibold text-gray-600 text-sm uppercase">
                          Model Information (no available parts)
                        </div>
                      )}

                      {modelSuggestions.filter((m) => m.priced_parts === 0).map((m, idx) => (
                        <Link
                          key={`model-unpriced-${idx}`}
                          to={`/model?model=${encodeURIComponent(m.model_number)}`}
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
                  {partSuggestions.length > 0 ? (
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

        {/* Menu container (width remainder) */}
        <div className="shrink-0 flex items-center basis-[10%] justify-end">
          <HeaderMenu />
        </div>
      </div>
    </header>
  );
};

export default Header;


