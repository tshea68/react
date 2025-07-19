import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const App = () => {
  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [popupImage, setPopupImage] = useState(null);
  const [query, setQuery] = useState("");
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState("");
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
        setModel(modelData);
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
    part.name?.toLowerCase().includes(filter.toLowerCase()) ||
    part.mpn?.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredAllParts = parts.all.filter(part =>
    part.name?.toLowerCase().includes(filter.toLowerCase()) ||
    part.mpn?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="bg-white p-4 rounded shadow mb-6 relative">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search model or part..."
          className="w-full px-4 py-2 border border-gray-300 rounded"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2 && (!modelNumber || query !== modelNumber)) {
              setShowDropdown(true);
            }
          }}
        />

        <AnimatePresence>
          {showDropdown && query.trim().length >= 2 && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-10 bg-white w-full mt-1 border rounded shadow"
            >
              {modelSuggestions.length === 0 && partSuggestions.length === 0 ? (
                <div className="px-4 py-2 text-gray-500">No matches found</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="border-r px-4 py-2">
                    <div className="text-xs text-gray-500 mb-1">Models</div>
                    {modelSuggestions.map((s, i) => (
                      <div
                        key={`m-${i}`}
                        className="cursor-pointer hover:bg-blue-100 px-2 py-1"
                        onClick={() => handleSelect(s.model_number)}
                      >
                        <div className="font-medium text-sm">{s.brand} - {s.model_number}</div>
                        <div className="text-xs text-gray-500">{s.appliance_type}</div>
                        {(s.total_parts !== undefined || s.priced_parts !== undefined) && (
                          <div className="text-[11px] text-gray-400 italic mt-1">
                            {s.total_parts ?? 0} known • {s.priced_parts ?? 0} priced
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-2">
                    <div className="text-xs text-gray-500 mb-1">Parts</div>
                    {partSuggestions.map((p, i) => (
                      <div key={`p-${i}`} className="px-2 py-1 border-b">
                        <div className="text-sm font-medium">{p.name} ({p.mpn})</div>
                        <div className="text-xs text-gray-600">
                          {p.price ? `$${p.price}` : "No price"} • {p.stock_status || "Contact us for availability"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && <div className="text-red-600 mb-6">{error}</div>}
      {!model && !error && <div className="text-gray-600">Loading model details...</div>}

      {model && (
        <>
          <div className="bg-white p-6 rounded shadow mb-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-1/4">
                <h1 className="text-2xl font-bold text-gray-900">
                  {model.brand} {model.model_number}
                </h1>
                <p className="text-xs text-gray-500 uppercase">{model.appliance_type}</p>
                <p className="text-green-700 font-semibold text-lg mt-2">
                  Total Parts: {model.total_parts}
                </p>
              </div>
              <div className="lg:w-3/4">
                <h2 className="text-sm font-semibold mb-2">Appliance Diagrams</h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {model.exploded_views?.map((view, idx) => (
                    <img
                      key={idx}
                      src={view.image_url}
                      alt={view.label}
                      loading="lazy"
                      className="w-48 h-[40vh] object-contain border rounded cursor-pointer flex-shrink-0"
                      onClick={() => setPopupImage(view)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow mb-4">
            <input
              type="text"
              placeholder="Filter parts by name or MPN..."
              className="w-full px-4 py-2 border border-gray-300 rounded mb-4"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <h2 className="text-xl font-semibold mb-4">Compatible Parts</h2>
            {loadingParts ? (
              <div className="text-center text-gray-500 py-6">Loading parts...</div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="flex-[0_0_70%] min-w-0">
                  {filteredPricedParts.map((part, idx) => (
                    <div key={idx} className="mb-4 p-3 border rounded bg-white">
                      <div className="text-lg font-semibold">{part.name}</div>
                      <div className="text-sm text-gray-500">MPN: {part.mpn}</div>
                      <div className="text-sm text-gray-500">Price: ${part.price}</div>
                      <div className="text-sm text-gray-500">Stock: {part.stock_status}</div>
                    </div>
                  ))}
                </div>
                <div className="flex-[0_0_30%] min-w-0 max-h-[70vh] overflow-y-auto bg-gray-50 border rounded p-3">
                  <h3 className="text-md font-semibold mb-2">All Known Parts</h3>
                  {filteredAllParts.map((part, idx) => (
                    <div key={idx} className="mb-3 border-b pb-2">
                      <div className="text-sm font-semibold">{part.mpn}</div>
                      <div className="text-xs text-gray-500">Diagram #: {part.sequence_number || "-"}</div>
                      {part.price ? (
                        <div className="text-xs text-gray-600">Price: ${part.price}</div>
                      ) : (
                        <div className="text-xs text-gray-500 italic">Contact us for availability</div>
                      )}
                      {part.stock_status && (
                        <div className="text-xs text-gray-600">Stock: {part.stock_status}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
  );
};

export default App;













