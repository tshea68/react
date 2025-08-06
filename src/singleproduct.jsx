// src/SingleProduct.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "./context/CartContext";

const BASE_URL = "https://fastapi-app-kkkq.onrender.com";

const SingleProduct = () => {
  const { mpn } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [part, setPart] = useState(null);
  const [modelData, setModelData] = useState(null);
  const [relatedParts, setRelatedParts] = useState([]);
  const [brandLogos, setBrandLogos] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [modelInput, setModelInput] = useState("");
  const [modelCheckResult, setModelCheckResult] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE_URL}/api/parts/${encodeURIComponent(mpn)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Part not found");
        return res.json();
      })
      .then(async (data) => {
        if (data.replaced_by_mpn && data.replaced_by_mpn !== data.mpn) {
          navigate(`/parts/${encodeURIComponent(data.replaced_by_mpn)}`);
          return;
        }

        setPart(data);
        const modelToUse = data.model || data.compatible_models?.[0];

        if (modelToUse) {
          const modelRes = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(modelToUse)}`);
          if (modelRes.ok) {
            const modelInfo = await modelRes.json();
            setModelData(modelInfo);
          }

          const partsRes = await fetch(`${BASE_URL}/api/parts/for-model/${encodeURIComponent(modelToUse.toLowerCase())}`);
          const partsData = await partsRes.json();
          const filtered = (partsData.parts || [])
            .filter((p) =>
              p?.mpn &&
              p?.price &&
              p.mpn.trim().toLowerCase() !== data.mpn.trim().toLowerCase()
            )
            .sort((a, b) => b.price - a.price)
            .slice(0, 6);
          setRelatedParts(filtered);
        }
      })
      .catch((err) => {
        console.error("❌ Failed to load part:", err);
        setError("Part not found.");
      })
      .finally(() => setLoading(false));
  }, [mpn, navigate]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/brand-logos`)
      .then((res) => res.json())
      .then(setBrandLogos)
      .catch((err) => console.error("Error loading logos", err));
  }, []);

  const handleModelCheck = (e) => {
    e.preventDefault();
    if (!part || !part.compatible_models) return;
    const isCompatible = part.compatible_models.some((m) => m.toLowerCase() === modelInput.toLowerCase());
    setModelCheckResult(isCompatible ? "yes" : "no");
  };

  if (loading) return <div className="p-4 text-xl">Loading part...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!part) return null;

  const brand = modelData?.brand || part.brand;
  const applianceType = modelData?.appliance_type?.replace(/\s*Appliance$/i, "") || part.appliance_type;
  const modelNumber = modelData?.model_number || part.model;
  const logoObj = brand
    ? brandLogos.find((b) => b.name?.toLowerCase().trim() === brand.toLowerCase().trim())
    : null;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-4 text-sm text-gray-500">
        <Link to="/" className="text-blue-600 hover:underline">Home</Link>
        {brand && <span className="mx-1"> / {brand}</span>}
        {applianceType && modelNumber && (
          <>
            <span className="mx-1"> / </span>
            <Link
              to={`/model?model=${encodeURIComponent(modelNumber)}`}
              className="text-blue-600 hover:underline"
            >
              {applianceType} {modelNumber}
            </Link>
          </>
        )}
        <span className="mx-1"> / </span>
        <span className="text-black font-semibold">{part.mpn}</span>
      </div>

      {modelNumber && (
        <div className="mb-4">
          <button
            className="text-blue-600 hover:underline text-sm"
            onClick={() => navigate(`/model?model=${encodeURIComponent(modelNumber)}`)}
          >
            ← Back to model page ({modelNumber})
          </button>
        </div>
      )}

      <div className="w-full bg-gray-100 border px-4 py-4 mb-4 flex flex-wrap items-center gap-4 text-lg font-semibold">
        {logoObj ? (
          <img src={logoObj.url} alt={brand} className="h-12 object-contain" />
        ) : (
          brand && <span className="text-base text-gray-700">{brand}</span>
        )}
        {applianceType && <span className="text-base text-gray-700">{applianceType}</span>}
        {modelNumber && (
          <span className="text-base">
            Model: <span className="font-bold">{modelNumber}</span>
          </span>
        )}
        <span className="text-base">
          Part: <span className="font-bold uppercase">{part.mpn}</span>
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-1/2">
          {part.image_url && (
            <img
              src={part.image_url}
              alt={part.name}
              className="w-full max-w-[900px] border rounded"
            />
          )}
        </div>

        <div className="md:w-1/2">
          <h1 className="text-2xl font-bold mb-4">{part.name || "Unnamed Part"}</h1>

          <form onSubmit={handleModelCheck} className="mb-4">
            <label className="block font-medium mb-1">Does this fit my model?</label>
            <div className="flex gap-2 max-w-xs">
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="Enter model number"
                className="border rounded px-3 py-2 w-full"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Check
              </button>
            </div>
            {modelCheckResult && (
              <p className={`mt-2 text-sm ${modelCheckResult === "yes" ? "text-green-600" : "text-red-600"}`}>
                {modelCheckResult === "yes"
                  ? `✅ Yes, this part fits model ${modelInput}`
                  : `❌ No, this part is not compatible with model ${modelInput}`}
              </p>
            )}
          </form>

          <p className="text-2xl font-bold mb-1 text-green-600">{part.price ? `$${part.price}` : "N/A"}</p>
          <p className={`inline-block px-3 py-1 text-sm rounded font-semibold mb-3 ${part.stock_status === "in stock" ? "bg-green-600 text-white" : "bg-black text-white"}`}>
            {part.stock_status || "Unknown"}
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="font-medium">Qty:</label>
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="border px-2 py-1 rounded"
            >
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>

            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={() => {
                addToCart(part, quantity);
                navigate("/cart");
              }}
            >
              Add to Cart
            </button>
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              onClick={() => {
                addToCart(part, quantity);
                window.location.href = "/checkout";
              }}
            >
              Buy Now
            </button>
          </div>

          {part.replaces_previous_parts && (
            <div className="text-sm mb-6">
              <strong>Replaces these older parts:</strong>
              <div className="flex flex-wrap gap-2 mt-1">
                {part.replaces_previous_parts.split(",").map((r, i) => (
                  <Link
                    key={i}
                    to={`/parts/${encodeURIComponent(r.trim())}`}
                    className="bg-gray-200 px-2 py-1 rounded text-xs font-mono hover:underline"
                  >
                    {r.trim()}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Other parts for this model</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {relatedParts.map((rp) => (
            <div key={rp.mpn} className="border p-4 rounded shadow-sm">
              <Link
                to={`/parts/${encodeURIComponent(rp.mpn)}`}
                className="font-medium hover:underline block mb-1 text-sm truncate"
              >
                {rp.name}
              </Link>
              {rp.image_url && (
                <img
                  src={rp.image_url}
                  alt={rp.name}
                  className="w-full h-32 object-contain mb-2"
                />
              )}
              <p className="text-xs text-gray-600">Part Number: {rp.mpn}</p>
              <p className="text-sm font-bold text-green-700">{rp.price ? `$${rp.price}` : "N/A"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SingleProduct;
