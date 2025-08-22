// src/ModelPage.jsx
import React, { useState, useEffect } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import PartImage from "./components/PartImage";

const API_BASE = import.meta.env.VITE_API_URL;

const ModelPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const modelNumber = searchParams.get("model") || "";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);
  const [loadingParts, setLoadingParts] = useState(false);
  const [brandLogos, setBrandLogos] = useState([]);

  useEffect(() => {
    const fetchModel = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch(`${API_BASE}/api/models/search?q=${modelNumber}`);
        const data = await res.json();
        const t1 = performance.now();
        console.log(`🟢 /api/models/search took ${(t1 - t0).toFixed(2)} ms`);
        if (!data || !data.model_number) {
          setModel(null);
        } else {
          setModel(data);
        }
      } catch (err) {
        console.error("❌ Error loading model data:", err);
        setError("Error loading model data.");
      }
    };

    const fetchParts = async () => {
      const t0 = performance.now();
      try {
        setLoadingParts(true);
        const res = await fetch(`${API_BASE}/api/parts/for-model/${modelNumber}`);
        if (!res.ok) throw new Error("Failed to fetch parts");
        const data = await res.json();
        const t1 = performance.now();
        console.log(`🔵 /api/parts/for-model took ${(t1 - t0).toFixed(2)} ms`);
        setParts({
          all: Array.isArray(data.all) ? data.all : [],
          priced: Array.isArray(data.priced) ? data.priced : [],
        });
      } catch (err) {
        console.error("❌ Error loading parts:", err);
      } finally {
        setLoadingParts(false);
      }
    };

    const fetchBrandLogos = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch(`${API_BASE}/api/brand-logos`);
        const data = await res.json();
        const t1 = performance.now();
        console.log(`🟡 /api/brand-logos took ${(t1 - t0).toFixed(2)} ms`);
        setBrandLogos(data);
      } catch (err) {
        console.error("❌ Error fetching brand logos:", err);
      }
    };

    if (modelNumber) {
      fetchModel();
      fetchParts();
      fetchBrandLogos();
    }

    // Clear query bar dropdown state on route change
    const input = document.querySelector("input[type='text']");
    if (input) input.value = "";
  }, [modelNumber, location]);

  const normalize = (str) => str?.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const match = brandLogos.find((b) => normalize(b.name) === normalize(brand));
    return match?.image_url || null;
  };

  if (error) {
    return <div className="text-red-600 text-center py-6">{error}</div>;
  }

  if (!model) return null;

  return (
    <div className="w-[90%] mx-auto pb-12">
      {/* Breadcrumb */}
      <div className="w-full border-b border-gray-200 mb-4">
        <nav className="text-sm text-gray-600 py-2 w-full">
          <ul className="flex space-x-2">
            <li>
              <Link to="/" className="hover:underline text-blue-600">Home</Link>
              <span className="mx-1">/</span>
            </li>
            <li className="font-semibold text-black">
              {model.brand} {model.appliance_type} {model.model_number}
            </li>
          </ul>
        </nav>
      </div>

      {/* Header section (logo left; continuous 30% gray on right; max height 100px) */}
      <div className="border rounded p-2 flex items-center mb-4 gap-3 max-h-[100px] overflow-hidden">
        {/* Brand logo (no gray) */}
        <div className="w-1/6 flex items-center justify-center">
          {getBrandLogoUrl(model.brand) ? (
            <img
              src={getBrandLogoUrl(model.brand)}
              alt={`${model.brand} Logo`}
              className="object-contain h-14"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="text-[10px] text-gray-500">No Logo</span>
          )}
        </div>

        {/* Right-side container with continuous gray */}
        <div className="w-5/6 bg-gray-500/30 rounded p-2 flex items-center gap-3 overflow-hidden">
          {/* Model meta */}
          <div className="w-1/3 leading-tight">
            <h2 className="text-sm font-semibold truncate">
              {model.brand} - {model.model_number} - {model.appliance_type}
            </h2>
            <p className="text-[11px] mt-1 text-gray-700">
              Known Parts: {parts.all.length} &nbsp;|&nbsp; Priced Parts: {parts.priced.length}
            </p>
          </div>

          {/* Exploded views strip */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-2">
            {model.exploded_views?.map((view, idx) => (
              <div key={idx} className="w-24 shrink-0">
                <div className="border rounded p-1 bg-white">
                  <img
                    src={view.image_url}
                    alt={view.label}
                    className="w-full h-14 object-contain cursor-pointer"
                    loading="lazy"
                    decoding="async"
                    onClick={() => setPopupImage(view.image_url)}
                    onError={(e) => (e.currentTarget.src = "/no-image.png")}
                  />
                  <p className="text-[10px] text-center mt-1 leading-tight truncate">{view.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popup Image */}
      {popupImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center"
          onClick={() => setPopupImage(null)}
        >
          <img src={popupImage} alt="Popup" className="max-h-[90vh] max-w-[90vw]" />
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-1/2 max-h-[600px] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-2">Available Parts</h3>
          {parts.priced.length === 0 ? (
            <p className="text-gray-500 mb-6">No priced parts available for this model.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {parts.priced.map((part) => (
                <Link
                  key={part.mpn}
                  to={`/parts/${part.mpn}`}
                  className="border rounded p-3 hover:shadow flex gap-4 items-center"
                >
                  <PartImage
                    imageUrl={part.image_url}
                    imageKey={part.image_key}
                    mpn={part.mpn}
                    alt={part.name}
                    className="w-20 h-20 object-contain"
                  />
                  <div>
                    <div className="text-sm font-medium">{part.name || part.mpn}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      ${part.price?.toFixed(2)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="md:w-1/2 max-h-[600px] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-2">All Known Parts</h3>
          {parts.all.length === 0 ? (
            <p className="text-gray-500">No parts found for this model.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {parts.all.map((part) => (
                <div key={part.mpn} className="border rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">#{part.sequence || "–"}</div>
                  <div className="text-sm font-medium">{part.name || part.mpn}</div>
                  <div className="text-xs text-gray-400 mt-1">{part.mpn}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelPage;

