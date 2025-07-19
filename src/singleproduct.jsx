import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const SingleProduct = () => {
  const { mpn } = useParams();
  const navigate = useNavigate();
  const [part, setPart] = useState(null);
  const [relatedParts, setRelatedParts] = useState([]);

  useEffect(() => {
    fetch(`/api/parts/${encodeURIComponent(mpn)}`)
      .then(res => res.json())
      .then(data => {
        setPart(data);

        if (data && data.model) {
          fetch(`/api/parts?model=${encodeURIComponent(data.model)}`)
            .then(res => res.json())
            .then(parts => {
              const filtered = parts.filter(p => p.mpn !== mpn).slice(0, 3);
              setRelatedParts(filtered);
            });
        }
      })
      .catch(err => console.error("Failed to load part or related parts:", err));
  }, [mpn]);

  if (!part) return <div className="p-4 text-xl">Loading part...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Breadcrumb / Back button */}
      <div className="mb-4">
        <button
          className="text-blue-600 hover:underline text-sm"
          onClick={() => navigate(`/?model=${encodeURIComponent(part.model)}`)}
        >
          ← Back to model page ({part.model})
        </button>
      </div>

      {/* Header */}
      <h1 className="text-2xl font-bold mb-4">{part.name}</h1>

      <div className="flex gap-8 flex-wrap md:flex-nowrap">
        {/* Main Product Info */}
        <div className="flex-1">
          <p className="text-lg">MPN: {part.mpn}</p>
          <p className="text-lg">Model: {part.model}</p>
          <p className="text-lg">Price: ${part.price}</p>
          <p className="text-lg">Stock: {part.stock_status}</p>
          <img
            src={part.image_url}
            alt={part.name}
            className="mt-4 max-w-[200px] border rounded"
          />
        </div>

        {/* Related Parts */}
        <div className="w-full md:w-1/3 mt-8 md:mt-0">
          <h2 className="text-xl font-semibold mb-2">Other parts for this model</h2>
          <ul className="space-y-4">
            {relatedParts.map((rp) => (
              <li key={rp.mpn} className="border p-2 rounded shadow-sm">
                <a href={`/part/${rp.mpn}`} className="font-medium hover:underline block">
                  {rp.name}
                </a>
                <p className="text-sm text-gray-600">MPN: {rp.mpn}</p>
                <p className="text-sm">${rp.price}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SingleProduct;



