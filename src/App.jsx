import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const App = () => {
  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [popupImage, setPopupImage] = useState(null);
  const [pricedFilter, setPricedFilter] = useState("");
  const [allFilter, setAllFilter] = useState("");
  const [query, setQuery] = useState("");
  const [advancedQuery, setAdvancedQuery] = useState("");
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [error, setError] = useState(null);
  const API_BASE = import.meta.env.VITE_API_URL;

  const modelNumber = new URLSearchParams(window.location.search).get("model") || "";
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const abortRef = useRef(null);

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

        const searchRes = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(modelNumber)}`);
        const modelData = searchRes.ok ? await searchRes.json() : null;
        if (!searchRes.ok || !modelData?.model_number) {
          setModel(null);
          setError("Model not found.");
          return;
        }

        const partsRes = await fetch(`${API_BASE}/api/parts/for-model/${modelNumber}`);
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

        if (abortRef.current) {
          abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        Promise.all([
          fetch(`${API_BASE}/api/suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal }),
          fetch(`${API_BASE}/api/suggest/parts?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        ])
          .then(async ([modelsRes, partsRes]) => {
            const models = modelsRes.ok ? await modelsRes.json() : [];
            const parts = partsRes.ok ? await partsRes.json() : [];
            setModelSuggestions(models.slice(0, 5));
            setPartSuggestions(parts.slice(0, 5));
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              console.error("❌ Suggest error:", err);
            }
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

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by model or MPN..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded"
          />
          <input
            type="text"
            placeholder="Search by brand, appliance type, name..."
            value={advancedQuery}
            onChange={(e) => setAdvancedQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded"
          />
        </div>

        <AnimatePresence>
          {showDropdown && (modelSuggestions.length > 0 || partSuggestions.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-md max-w-xl mx-auto"
            >
              <div className="p-2" ref={dropdownRef}>
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
                      <Link
                        key={`part-${idx}`}
                        to={`/parts/${encodeURIComponent(p.mpn)}`}
                        className="block px-3 py-2 hover:bg-gray-100 text-sm"
                      >
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">MPN: {p.mpn}</div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {model && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold">{model.brand} {model.model_number}</h1>
              <p className="text-gray-600 uppercase text-sm">{model.appliance_type}</p>
              <div className="text-sm mt-1">Available Parts: {model.priced_parts} | All Known Parts: {model.total_parts}</div>
            </div>

            <div className="mb-6 overflow-x-auto whitespace-nowrap space-x-4 pb-2">
              {model.exploded_views?.map((view, idx) => (
                <div
                  key={idx}
                  className="inline-block relative w-48 h-48 border rounded overflow-hidden cursor-pointer group"
                  onClick={() => setPopupImage(view)}
                >
                  <img src={view.image_url} alt={view.label} className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center text-white text-sm opacity-0 group-hover:opacity-100 transition">
                    Click to See Full View
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="mb-2 font-semibold text-lg">Available Parts</div>
                <input
                  type="text"
                  placeholder="Filter available parts..."
                  value={pricedFilter}
                  onChange={(e) => setPricedFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded mb-2"
                />
                <div className="h-[600px] overflow-y-auto space-y-2">
                  {parts.priced.filter(part =>
                    part.name?.toLowerCase().includes(pricedFilter.toLowerCase()) ||
                    part.mpn?.toLowerCase().includes(pricedFilter.toLowerCase())
                  ).map((part, idx) => (
                    <Link
                      key={idx}
                      to={`/parts/${encodeURIComponent(part.mpn)}`}
                      className="flex border p-3 bg-white rounded shadow-sm hover:bg-gray-50 transition cursor-pointer"
                    >
                      <img src={part.image_url} alt={part.name} className="w-16 h-16 object-contain mr-4" />
                      <div className="flex flex-col justify-between">
                        <div className="font-semibold text-sm">{part.name} ({part.mpn})</div>
                        <div className="text-sm text-green-700">${part.price}</div>
                        <div className={`text-xs ${part.stock_status === 'instock' ? 'text-green-600' : 'text-red-600'}`}>{part.stock_status}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 font-semibold text-lg">All Known Parts</div>
                <input
                  type="text"
                  placeholder="Filter all known parts..."
                  value={allFilter}
                  onChange={(e) => setAllFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded mb-2"
                />
                <div className="h-[600px] overflow-y-auto space-y-2">
                  {parts.all.filter(part =>
                    part.name?.toLowerCase().includes(allFilter.toLowerCase()) ||
                    part.mpn?.toLowerCase().includes(allFilter.toLowerCase())
                  ).map((part, idx) => (
                    <div key={idx} className="border p-3 bg-white rounded shadow-sm">
                      <div className="text-sm font-medium">{part.name} ({part.mpn})</div>
                      <div className="text-xs text-gray-500">Sequence: {part.sequence_number || "-"}</div>
                      <div className="text-xs text-gray-500">Stock: {part.stock_status || "Unknown"}</div>
                      {part.price && <div className="text-sm text-green-700">${part.price}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {popupImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setPopupImage(null)}
          >
            <div
              className="bg-white p-4 rounded shadow-lg w-[90%] max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={popupImage.image_url} alt={popupImage.label} className="max-h-[70vh] mx-auto mb-2 object-contain" />
              <p className="text-center text-sm text-gray-700">{popupImage.label}</p>
              <button
                className="mt-4 px-6 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-700 block mx-auto"
                onClick={() => setPopupImage(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;























