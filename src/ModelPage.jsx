// src/ModelPage.jsx
import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL;

const ModelPage = () => {
  const [searchParams] = useSearchParams();
  const modelNumber = searchParams.get("model") || "";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);
  const [loadingParts, setLoadingParts] = useState(false);
  const [brandLogos, setBrandLogos] = useState([]);

  useEffect(() => {
    const fetchBrandLogos = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/brand-logos`);
        const data = await res.json();
        setBrandLogos(data);
      } catch (e) {
        console.error("Failed to load brand logos:", e);
      }
    };
    fetchBrandLogos();
  }, []);

  useEffect(() => {
    if (!modelNumber) return;

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

        const normalizedModel = modelNumber.trim().toLowerCase();
        const partsRes = await fetch(`${API_BASE}/api/parts/for-model/${encodeURIComponent(normalizedModel)}`);
        const partsData = partsRes.ok ? await partsRes.json() : { parts: [] };

        const allParts = (partsData.parts || []).filter((p) => p && typeof p.mpn === "string" && p.mpn.trim() !== "");
        const priced = allParts.filter((p) => p.price != null);

        const sortedAllParts = allParts.sort((a, b) => {
          const aSeq = a.sequence_number ?? "";
          const bSeq = b.sequence_number ?? "";
          return aSeq.localeCompare(bSeq);
        });

        setParts({ priced, all: sortedAllParts });
        setModel({
          ...modelData,
          total_parts: sortedAllParts.length,
          priced_parts: priced.length,
        });
      } catch (err) {
        console.error("❌ Error loading model or parts", err);
        setModel(null);
        setError("Error loading model data.");
      } finally {
        setLoadingParts(false);
      }
    })();
  }, [modelNumber]);

  return (
    <div className="w-4/5 mx-auto p-6">
      <div className="mb-4 text-sm text-gray-500">
        <Link to="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-1">/</span>
        {model?.brand && <span className="text-gray-700 font-medium">{model.brand}</span>}
        {model?.appliance_type && <span className="text-gray-700 font-medium ml-1">{model.appliance_type}</span>}
        {model?.model_number && <span className="text-gray-700 font-semibold ml-1">{model.model_number}</span>}
      </div>

      {error && <div className="text-red-500 text-center mt-4">{error}</div>}

      {model && (
        <>
          <div className="flex mb-6 border border-[#233F92]">
            <div className="w-[15%] bg-white flex items-center justify-center border-r border-[#233F92]">
              {(() => {
                const modelBrand = model.brand?.toLowerCase();
                const match = brandLogos.find(
                  (b) => typeof b.name === "string" && b.name.toLowerCase() === modelBrand
                );
                return match?.url ? (
                  <img src={match.url} alt={model.brand} className="w-full h-full object-contain" />
                ) : (
                  <div className="text-xs text-gray-400 text-center px-2">No Logo</div>
                );
              })()}
            </div>
            <div className="w-[40%] bg-[#FFB91F] px-6 py-4 text-black flex flex-col justify-center border-r border-[#233F92]">
              <div className="text-lg font-bold mb-1">
                {model.brand} - {model.model_number} - {model.appliance_type}
              </div>
              <div className="text-sm font-medium">
                Known Parts: {model.total_parts} | Priced Parts: {model.priced_parts}
              </div>
            </div>
            <div className="w-[45%] overflow-x-auto whitespace-nowrap p-3">
              <div className="flex gap-3">
                {model.exploded_views?.map((view, idx) => (
                  <div
                    key={idx}
                    className="relative w-32 h-32 border rounded overflow-hidden cursor-pointer group flex-shrink-0"
                    onClick={() => setPopupImage(view)}
                  >
                    <img src={view.image_url} alt={view.label} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition">
                      View
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-lg mb-2">Available Parts</h3>
              <div className="h-[600px] overflow-y-auto space-y-2">
                {parts.priced.map((part, idx) => (
                  <div key={idx} className="flex border p-3 bg-white rounded shadow-sm hover:bg-gray-50 gap-4">
                    <div className="w-1/3 flex items-center justify-center">
                      {part.image_url ? (
                        <img src={part.image_url} alt={part.name} className="max-h-20 object-contain" />
                      ) : (
                        <div className="text-xs text-gray-400">No Image</div>
                      )}
                    </div>
                    <div className="w-2/3">
                      <div className="font-medium text-base">{part.name} ({part.mpn})</div>
                      <div className="text-base text-green-700">{part.price ? `$${part.price}` : "No Price Available"}</div>
                      <div className={`text-sm ${part.stock_status === 'instock' ? 'text-green-600' : 'text-red-600'}`}>
                        {part.stock_status || "Contact Us"}
                      </div>
                      <Link
                        to={`/parts/${encodeURIComponent(part.mpn)}`}
                        className="inline-block mt-2 px-4 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Click for Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">All Known Parts</h3>
              <div className="h-[600px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                {parts.all.map((part, idx) => (
                  <div key={idx} className="border p-3 bg-white rounded shadow-sm text-sm">
                    <div className="font-medium text-sm mb-1">{part.name} ({part.mpn})</div>
                    <div className="font-mono text-xs mb-1 text-gray-600">Diagram Number: {part.sequence_number || "-"}</div>
                    <div className="text-gray-600 mb-1">{part.stock_status || "Contact Us"}</div>
                    <div className="text-green-700 font-semibold">
                      {part.price ? `$${part.price}` : "No Price Available"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

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
        </>
      )}
    </div>
  );
};

export default ModelPage;

