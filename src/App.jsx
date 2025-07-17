// src/App.jsx
import React, { useEffect, useState } from "react";
import VirtualizedPartsGrid from "./VirtualizedPartsGrid";

const App = () => {
  const [model, setModel] = useState(null);
  const [parts, setParts] = useState([]);
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [filter, setFilter] = useState("");
  const [loadingParts, setLoadingParts] = useState(false);
  const [useVirtualized, setUseVirtualized] = useState(true); // default ON

  const modelNumber = new URLSearchParams(window.location.search).get("model") || "";
  const API_BASE = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!modelNumber) return;

    (async () => {
      try {
        console.log("🔍 Fetching model for:", modelNumber);
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(modelNumber)}`);
        if (!res.ok) throw new Error("Search request failed");

        const data = await res.json();
        if (!data.model_number) {
          setError("Model not found.");
          return;
        }

        setModel(data);

        console.log("📦 Fetching parts and exploded views...");
        setLoadingParts(true);
        const [partsRes, viewsRes] = await Promise.all([
          fetch(`${API_BASE}/api/parts/for-model/${modelNumber}`),
          fetch(`${API_BASE}/api/models/${modelNumber}/exploded-views`)
        ]);

        if (partsRes.ok) {
          const partsData = await partsRes.json();
          const sortedParts = (partsData.parts || [])
            .filter((p) => !!p.price)
            .sort((a, b) => (b.stock_status === "instock") - (a.stock_status === "instock"));
          setParts(sortedParts);
          console.log("✅ Loaded parts:", sortedParts.length);
        } else {
          console.warn("⚠️ Parts fetch failed");
        }

        if (viewsRes.ok) {
          const viewsData = await viewsRes.json();
          setModel((prev) => ({ ...prev, exploded_views: viewsData }));
        } else {
          console.warn("⚠️ Exploded views fetch failed");
        }

        if (!partsRes.ok && !viewsRes.ok) {
          throw new Error("Parts and views fetch both failed");
        }
      } catch (err) {
        console.error("❌ Fetch error:", err);
        setError("Error loading model data.");
      } finally {
        setLoadingParts(false);
      }
    })();
  }, [modelNumber]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.length >= 2) {
        setLoadingSuggestions(true);
        fetch(`${API_BASE}/suggest?q=${encodeURIComponent(query)}`)
          .then((res) => res.json())
          .then((data) => setSuggestions(data || []))
          .catch((err) => {
            console.error("Suggestion fetch failed", err);
            setSuggestions([]);
          })
          .finally(() => setLoadingSuggestions(false));
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleSelect = (modelNum) => {
    window.location.href = `?model=${encodeURIComponent(modelNum)}`;
  };

  const filteredParts = parts.filter(part =>
    part.name?.toLowerCase().includes(filter.toLowerCase()) ||
    part.mpn?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="bg-white p-4 rounded shadow mb-6 relative">
        <input
          type="text"
          placeholder="Search model number..."
          className="w-full px-4 py-2 border border-gray-300 rounded"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 bg-white w-full mt-1 border rounded shadow">
            {suggestions.map((s, i) => (
              <li
                key={i}
                className="px-4 py-2 hover:bg-blue-100 cursor-pointer text-sm"
                onClick={() => handleSelect(s.model_number)}
              >
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{s.model_number}</div>
                </div>
                <div className="text-gray-500 text-xs">
                  {s.brand} — {s.appliance_type}
                </div>
              </li>
            ))}
          </ul>
        )}
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
                      className="w-48 h-48 object-contain border rounded cursor-pointer flex-shrink-0"
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
              <VirtualizedPartsGrid parts={filteredParts} />
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
            className="bg-white p-4 rounded shadow-lg max-w-2xl w-[90%] max-h-[95vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={popupImage.image_url} alt={popupImage.label} className="w-full h-auto mb-2" />
            <p className="text-center text-sm text-gray-700">{popupImage.label}</p>
            <button
              className="mt-3 px-4 py-1 bg-gray-800 text-white rounded text-sm hover:bg-gray-700 block mx-auto"
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





















