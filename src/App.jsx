// src/App.jsx
import React, { useEffect, useState } from "react";

const App = () => {
  const [model, setModel] = useState(null);
  const [parts, setParts] = useState([]);
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [filter, setFilter] = useState("");

  const modelNumber = new URLSearchParams(window.location.search).get("model") || "";
  const API_BASE = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!modelNumber) return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(modelNumber)}`);
        if (!res.ok) throw new Error("Search request failed");

        const data = await res.json();
        if (!data.model_number) {
          setError("Model not found.");
          return;
        }

        setModel(data);

        const [partsRes, viewsRes] = await Promise.all([
          fetch(`${API_BASE}/api/parts/for-model/${modelNumber}`),
          fetch(`${API_BASE}/api/models/${modelNumber}/exploded-views`)
        ]);

        if (!partsRes.ok) throw new Error("Parts fetch failed");

        const partsData = await partsRes.json();
        const viewsData = viewsRes.ok ? await viewsRes.json() : [];

        const sortedParts = (partsData.parts || []).sort(
          (a, b) => (b.stock_status === "instock") - (a.stock_status === "instock")
        );

        setParts(sortedParts);
        setModel((prev) => ({
          ...prev,
          exploded_views: viewsData
        }));
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Error loading model data.");
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
                  <img
                    src={`https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/${s.brand_slug}.webp`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/${s.brand_slug}.png`;
                      e.target.onerror = () => {
                        e.target.onerror = null;
                        e.target.src = `https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/${s.brand_slug}.jpg`;
                      };
                    }}
                    alt={s.brand}
                    className="w-6 h-6 object-contain"
                  />
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
                <h1 className="text-lg font-bold text-gray-900">Model: {model.model_number}</h1>
                <p className="text-xs text-gray-500 uppercase">{model.appliance_type}</p>
                <p className="text-green-700 font-semibold text-lg mt-2">
                  Total Parts: {model.total_parts}
                </p>
                <img
                  src={`https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/${model.brand_slug}.webp`}
                  alt={model.brand}
                  className="w-28 mt-4 object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/${model.brand_slug}.png`;
                    e.target.onerror = () => {
                      e.target.onerror = null;
                      e.target.src = `https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/${model.brand_slug}.jpg`;
                    };
                  }}
                />
              </div>
              <div className="lg:w-3/4">
                <h2 className="text-sm font-semibold mb-2">Appliance Diagrams</h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {model.exploded_views?.map((view, idx) => (
                    <img
                      key={idx}
                      src={view.image_url}
                      alt={view.label}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {filteredParts.map((part, index) => {
                let stockClass = "text-black font-bold";
                let stockLabel = "Contact Us";
                if (part.stock_status?.toLowerCase() === "instock") {
                  stockClass = "text-green-700";
                  stockLabel = "In Stock";
                } else if (part.stock_status) {
                  stockClass = "text-red-700";
                  stockLabel = part.stock_status;
                }
                return (
                  <div key={`${part.mpn}-${index}`} className="border rounded p-4 flex flex-col">
                    <img
                      src={part.image_url || "https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/imagecomingsoon.png"}
                      alt={part.name}
                      className="w-full h-28 object-contain mb-2"
                    />
                    <div className="font-semibold text-sm mb-1">{part.name}</div>
                    <div className="text-xs text-gray-500 mb-1">MPN: {part.mpn}</div>
                    {part.price && (
                      <div className="text-green-700 font-bold mb-1">${part.price}</div>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full w-fit ${stockClass}`}>{stockLabel}</span>
                  </div>
                );
              })}
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
            className="bg-white p-4 rounded shadow-lg max-w-2xl w-[90%]"
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











