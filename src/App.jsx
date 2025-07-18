import React, { useEffect, useState, useRef } from "react";
import VirtualizedPartsGrid from "./VirtualizedPartsGrid";
import { motion, AnimatePresence } from "framer-motion";

const App = () => {
  const [model, setModel] = useState(null);
  const [parts, setParts] = useState([]);
  const [popupImage, setPopupImage] = useState(null);
  const [query, setQuery] = useState("");
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState("");
  const [loadingParts, setLoadingParts] = useState(false);
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
    setTimeout(() => {
      window.location.href = `?model=${encodeURIComponent(modelNum)}`;
    }, 0);
  };

  useEffect(() => {
    setQuery(modelNumber);
    if (!modelNumber) return;

    (async () => {
      try {
        const searchRes = await fetch(`${API_BASE}/search?q=${encodeURIComponent(modelNumber)}`);
        const modelData = searchRes.ok ? await searchRes.json() : null;
        console.log("🔍 Model returned:", modelData);
        if (!searchRes.ok || !modelData?.model_number) return;

        const [partsRes, viewsRes] = await Promise.all([
          fetch(`${API_BASE}/parts/for-model/${modelNumber}`),
          fetch(`${API_BASE}/models/${modelNumber}/exploded-views`)
        ]);

        const partsData = partsRes.ok ? await partsRes.json() : { parts: [] };
        const viewsData = viewsRes.ok ? await viewsRes.json() : [];
        console.log("📸 Exploded views returned:", viewsData);

        const sortedParts = (partsData.parts || [])
          .filter((p) => !!p.price)
          .sort((a, b) => (b.stock_status === "instock") - (a.stock_status === "instock"));

        setParts(sortedParts);
        setModel({ ...modelData, exploded_views: viewsData });
      } catch {
        setModel(null);
      } finally {
        setLoadingParts(false);
      }
    })();
  }, [modelNumber]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.trim().length >= 2) {
        setShowDropdown(true);

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
  }, [query]);

  const filteredParts = parts.filter(part =>
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
            if (query.trim().length >= 2) setShowDropdown(true);
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
                {model.exploded_views && model.exploded_views.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {model.exploded_views.map((view, idx) => (
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
                ) : (
                  <div className="text-gray-500 text-sm">No exploded diagrams available for this model.</div>
                )}
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
            ) : filteredParts.length > 0 ? (
              <VirtualizedPartsGrid parts={filteredParts} />
            ) : (
              <div className="text-center text-gray-500 py-4">No parts available for this model.</div>
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
            <img
              src={popupImage.image_url}
              alt={popupImage.label}
              className="max-h-[70vh] mx-auto mb-2 object-contain"
            />
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





























