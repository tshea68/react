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
                <p className="text-green-700 font-semibold text-sm mt-2">
                  All Known Parts: {model.total_parts}
                </p>
                <p className="text-green-700 font-semibold text-sm">
                  Available Parts: {model.priced_parts}
                </p>
              </div>
              <div className="lg:w-3/4">
                <h2 className="text-sm font-semibold mb-2">Appliance Diagrams</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 max-h-[200px] overflow-y-auto">
                  {model.exploded_views?.map((view, idx) => (
                    <div
                      key={idx}
                      className="relative w-40 h-40 border rounded cursor-pointer overflow-hidden hover:brightness-75"
                      onClick={() => setPopupImage(view)}
                    >
                      <img
                        src={view.image_url}
                        alt={view.label}
                        loading="lazy"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-40 text-white text-xs opacity-0 hover:opacity-100">
                        Click to See Full View
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-7/12">
              <div className="text-xl font-semibold mb-2">Available Parts</div>
              <input
                type="text"
                placeholder="Search available parts..."
                className="w-full px-4 py-2 border border-gray-300 rounded mb-4"
                value={pricedFilter}
                onChange={(e) => setPricedFilter(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                {filteredPricedParts.map((part, idx) => (
                  <div key={idx} className="flex gap-3 p-3 border rounded bg-white">
                    <img
                      src={part.image_url || "https://via.placeholder.com/60"}
                      alt={part.name}
                      className="w-20 h-20 object-contain"
                    />
                    <div className="flex flex-col justify-between">
                      <div className="text-md font-semibold">{part.name}</div>
                      <div className="text-sm text-gray-500">MPN: {part.mpn}</div>
                      <div className="text-sm text-green-700">${part.price}</div>
                      <div className={`text-sm ${part.stock_status?.toLowerCase() === "in stock" ? "text-green-700" : "text-red-600"}`}>{part.stock_status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-5/12">
              <div className="text-xl font-semibold mb-2">All Known Parts</div>
              <input
                type="text"
                placeholder="Search all parts..."
                className="w-full px-4 py-2 border border-gray-300 rounded mb-4"
                value={allFilter}
                onChange={(e) => setAllFilter(e.target.value)}
              />
              <div className="max-h-[70vh] overflow-y-auto bg-gray-50 border rounded p-3">
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
                      <div className={`text-xs ${part.stock_status?.toLowerCase() === "in stock" ? "text-green-700" : "text-red-600"}`}>{part.stock_status}</div>
                    )}
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
  );
};

export default App;


















