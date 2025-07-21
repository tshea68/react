import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

// ✅ Set your FastAPI backend URL here:
const BASE_URL = "https://fastapi-app-kkkq.onrender.com";

const SingleProduct = () => {
  const { mpn } = useParams();
  const navigate = useNavigate();
  const [part, setPart] = useState(null);
  const [relatedParts, setRelatedParts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    fetch(`${BASE_URL}/api/parts/${encodeURIComponent(mpn)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Part not found");
        return res.json();
      })
      .then((data) => {
        setPart(data);

        if (data && data.model) {
          fetch(`${BASE_URL}/api/parts/for-model/${encodeURIComponent(data.model)}`)
            .then((res) => res.json())
            .then((result) => {
              const filtered = (result.parts || [])
                .filter((p) => p.mpn !== data.mpn)
                .slice(0, 3);
              setRelatedParts(filtered);
            });
        }
      })
      .catch((err) => {
        console.error("❌ Failed to load part:", err);
        setError("Part not found.");
      })
      .finally(() => setLoading(false));
  }, [mpn]);

  if (loading) return <div className="p-4 text-xl">Loading part...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!part) return null;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-4">
        {part.model && (
          <button
            className="text-blue-600 hover:underline text-sm"
            onClick={() => navigate(`/?model=${encodeURIComponent(part.model)}`)}
          >
            ← Back to model page ({part.model})
          </button>
        )}
      </div>

      <h1 className="text-2xl font-bold mb-4">{part.name || "Unnamed Part"}</h1>

      <div className="flex gap-8 flex-wrap md:flex-nowrap">
        <div className="flex-1">
          <p className="text-lg mb-1">MPN: {part.mpn}</p>
          <p className="text-lg mb-1">Model: {part.model || "Unknown"}</p>
          <p className="text-lg mb-1">Price: {part.price ? `$${part.price}` : "N/A"}</p>
          <p className="text-lg mb-1">Stock: {part.stock_status || "Unknown"}</p>
          {part.image_url && (
            <img
              src={part.image_url}
              alt={part.name}
              className="mt-4 max-w-[200px] border rounded"
            />
          )}
        </div>

        <div className="w-full md:w-1/3 mt-8 md:mt-0">
          <h2 className="text-xl font-semibold mb-2">Other parts for this model</h2>
          <ul className="space-y-4">
            {relatedParts.map((rp) => (
              <li key={rp.mpn} className="border p-2 rounded shadow-sm">
                <Link
                  to={`/parts/${encodeURIComponent(rp.mpn)}`}
                  className="font-medium hover:underline block"
                >
                  {rp.name}
                </Link>
                <p className="text-sm text-gray-600">MPN: {rp.mpn}</p>
                <p className="text-sm">{rp.price ? `$${rp.price}` : "N/A"}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SingleProduct;





