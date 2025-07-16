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

        if (!partsRes.ok || !viewsRes.ok) throw new Error("Parts or views fetch failed");

        const partsData = await partsRes.json();
        const viewsData = await viewsRes.json();

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

      {/* Conditional rendering for model and parts */}
    </div>
  );
};

export default App;






