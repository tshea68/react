// App.jsx
import React, { useEffect, useState } from "react";

const App = () => {
  const [model, setModel] = useState(null);
  const [parts, setParts] = useState([]);
  const modelNumber = new URLSearchParams(window.location.search).get("model") || "LFD301EW0";

  useEffect(() => {
    fetch(`https://fastapi-app-kkkq.onrender.com/api/models/search?q=${modelNumber}`)
      .then((res) => res.json())
      .then((data) => {
        const m = data.results.find((r) => r.model_number === modelNumber);
        setModel(m);
      });

    fetch(`https://fastapi-app-kkkq.onrender.com/api/models/${modelNumber}/parts`)
      .then((res) => res.json())
      .then((data) => setParts(data.parts));
  }, [modelNumber]);

  if (!model) return <div className="p-6 text-center text-gray-500">Loading model...</div>;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-10">
        <img src={model.brand_logo_url} alt={model.brand} className="w-24 h-auto border p-1 rounded" />
        <div>
          <h1 className="text-3xl font-bold mb-1">{model.model_number}</h1>
          <p className="text-gray-600 text-sm uppercase">{model.appliance_type}</p>
          <p className="text-sm text-gray-700 mt-1">Total Parts: {model.total_parts}</p>
        </div>
      </div>

{/* Exploded Views */}
{model.exploded_views?.length > 0 && (
  <div className="mb-12">
    <h2 className="text-2xl font-semibold mb-4">Exploded Views</h2>
    <div className="overflow-x-auto whitespace-nowrap space-x-4 flex pb-2">
      {model.exploded_views.map((view, i) => (
        <div
          key={i}
          className="relative group inline-block w-40 shrink-0 border rounded bg-white p-2 shadow-sm"
        >
          <img
            src={view.image_url}
            alt={view.label}
            className="w-full h-28 object-contain rounded"
          />
          <div className="absolute left-0 top-full mt-2 w-72 bg-white border shadow-lg rounded p-2 hidden group-hover:block z-50">
            <img
              src={view.image_url}
              alt={view.label}
              className="w-full max-h-60 object-contain rounded"
            />
            <p className="text-xs text-center mt-1 text-gray-700">{view.label}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

      {/* All MPNs List */}
      {parts.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-medium mb-2">All Matching MPNs</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 columns-2 sm:columns-3">
            {parts.map((part) => (
              <li key={part.id}>{part.mpn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Parts Grid */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Available WooCommerce Parts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {parts.map((part) => (
            <div key={part.id} className="border p-4 rounded shadow hover:shadow-md transition bg-white">
              <img
                src={`https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/${part.thumbnail_id}.jpg`}
                alt={part.title}
                className="w-full h-32 object-contain mb-2"
              />
              <h3 className="text-sm font-semibold mb-1">{part.title}</h3>
              <p className="text-xs text-gray-500">MPN: {part.mpn}</p>
              <p className="text-sm text-green-600 font-medium mt-1">${part.price}</p>
              <p className="text-xs text-gray-500">
                {part.stock_status === "instock" ? "In Stock" : "Out of Stock"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;

