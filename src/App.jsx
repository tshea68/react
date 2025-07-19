import React, { useEffect, useState, useRef } from "react";
import VirtualizedPartsGrid from "./VirtualizedPartsGrid";
import { motion, AnimatePresence } from "framer-motion";

const App = () => {
  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], unpriced: [] });
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
        const unpriced = allParts.filter(p => p.price == null);

        setParts({ priced, unpriced });
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

  const filteredUnpricedParts = parts.unpriced.filter(part =>
    part.name?.toLowerCase().includes(filter.toLowerCase()) ||
    part.mpn?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* ... Search bar and dropdown unchanged ... */}

      {model && (
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
            <div className="flex flex-col lg:flex-row gap-4 items-start">
              <div className="basis-[70%] min-w-0">
                <VirtualizedPartsGrid parts={filteredPricedParts} />
              </div>
              <div className="basis-[30%] min-w-0">
                <h3 className="text-md font-semibold mb-2">Known but Unpriced Parts</h3>
                <div className="bg-gray-50 border rounded p-3 max-h-[65vh] overflow-y-auto">
                  {filteredUnpricedParts.map((part, idx) => (
                    <div key={idx} className="mb-3 border-b pb-2">
                      <div className="text-sm font-semibold">{part.name}</div>
                      <div className="text-xs text-gray-600">MPN: {part.mpn}</div>
                      {part.diagram_number && (
                        <div className="text-xs text-gray-500">Diagram: {part.diagram_number}</div>
                      )}
                      <div className="text-xs text-gray-500 italic">Contact us for availability</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;











