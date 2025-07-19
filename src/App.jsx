import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const App = () => {
  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [popupImage, setPopupImage] = useState(null);
  const [pricedFilter, setPricedFilter] = useState("");
  const [allFilter, setAllFilter] = useState("");
  const [query, setQuery] = useState("");
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [error, setError] = useState(null);
  const API_BASE = import.meta.env.VITE_API_URL;

  const modelNumber = new URLSearchParams(window.location.search).get("model") || "";

  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !searchRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (modelNum) => {
    setShowDropdown(false);
    setModelSuggestions([]);
    setPartSuggestions([]);
    setQuery(modelNum);
    if (modelNum !== modelNumber) {
      window.location.href = `?model=${encodeURIComponent(modelNum)}`;
    }
  };

  useEffect(() => {
    if (!modelNumber) return;
    setQuery(modelNumber);
    (async () => {
      try {
        setLoadingParts(true);
        setError(null);

        const searchRes = await fetch(`${API_BASE}/search?q=${encodeURIComponent(modelNumber)}`);
        const modelData = searchRes.ok ? await searchRes.json() : null;
        if (!searchRes.ok || !modelData?.model_number) {
          setModel(null);
          setError("Model not found.");
          return;
        }

        const partsRes = await fetch(`${API_BASE}/parts/for-model/${modelNumber}`);
        const partsData = partsRes.ok ? await partsRes.json() : { parts: [] };

        const allParts = (partsData.parts || []).filter((p) => p && p.mpn);
        const priced = allParts.filter(p => p.price != null);

        const sortedAllParts = allParts.sort((a, b) => {
          const aSeq = a.sequence_number ?? "";
          const bSeq = b.sequence_number ?? "";
          return (aSeq === "" ? -1 : bSeq === "" ? 1 : aSeq.localeCompare(bSeq));
        });

        setParts({ priced, all: sortedAllParts });
        setModel({ ...modelData, total_parts: sortedAllParts.length, priced_parts: priced.length });
      } catch (err) {
        console.error("❌ Error loading model or parts", err);
        setModel(null);
        setError("Error loading model data.");
      } finally {
        setLoadingParts(false);
      }
    })();
  }, [modelNumber]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.trim().length >= 2) {
        if (!modelNumber || query !== modelNumber) {
          setShowDropdown(true);
        }
        Promise.all([
          fetch(`${API_BASE}/suggest?q=${encodeURIComponent(query)}`),
          fetch(`${API_BASE}/suggest/parts?q=${encodeURIComponent(query)}`),
        ])
          .then(async ([modelsRes, partsRes]) => {
            const models = modelsRes.ok ? await modelsRes.json() : [];
            const parts = partsRes.ok ? await partsRes.json() : [];
            setModelSuggestions(models.slice(0, 5));
            setPartSuggestions(parts.slice(0, 5));
          })
          .catch(() => {
            setModelSuggestions([]);
            setPartSuggestions([]);
          });
      } else {
        setModelSuggestions([]);
        setPartSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, modelNumber]);

  const filteredPricedParts = parts.priced.filter(part =>
    part.name?.toLowerCase().includes(pricedFilter.toLowerCase()) ||
    part.mpn?.toLowerCase().includes(pricedFilter.toLowerCase())
  );

  const filteredAllParts = parts.all.filter(part =>
    part.name?.toLowerCase().includes(allFilter.toLowerCase()) ||
    part.mpn?.toLowerCase().includes(allFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="relative max-w-xl mx-auto mb-6" ref={dropdownRef}>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search by model number..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded"
          onFocus={() => {
            if (modelSuggestions.length || partSuggestions.length) setShowDropdown(true);
          }}
        />
        <AnimatePresence>
          {showDropdown && (modelSuggestions.length > 0 || partSuggestions.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-md"
            >
              <div className="p-2">
                {modelSuggestions.length > 0 && (
                  <>
                    <div className="text-xs font-semibold text-gray-500 px-2 py-1">Models</div>
                    {modelSuggestions.map((m, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => handleSelect(m.model_number)}
                      >
                        <div className="font-medium">{m.brand} - {m.model_number}</div>
                        <div className="text-xs text-gray-500">{m.appliance_type}</div>
                      </div>
                    ))}
                  </>
                )}
                {partSuggestions.length > 0 && (
                  <>
                    <div className="text-xs font-semibold text-gray-500 px-2 py-1">Parts</div>
                    {partSuggestions.map((p, idx) => (
                      <div
                        key={`part-${idx}`}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      >
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">MPN: {p.mpn}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && <div className="text-red-600 mb-6">{error}</div>}
      {!model && !error && <div className="text-gray-600">Loading model details...</div>}

      {/* the rest of the layout remains as is */}



















