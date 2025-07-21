import React from "react";

const ModelPartsGrid = ({ parts }) => {
  if (!parts.length) {
    return <div className="text-gray-500">No parts found for this model.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {parts.map((part, idx) => (
        <div key={idx} className="bg-white p-4 border rounded shadow">
          <h3 className="text-sm font-bold mb-1">{part.name}</h3>
          <p className="text-xs text-gray-600 mb-2">MPN: {part.mpn}</p>
          <p className={`text-sm font-semibold ${part.stock_status?.toLowerCase() === 'in stock' ? 'text-green-600' : 'text-red-500'}`}>
            {part.stock_status || 'Unknown'}
          </p>
          {part.price && (
            <p className="text-sm text-gray-700 mt-1">Price: {part.price}</p>
          )}
          {part.image_url && (
            <img src={part.image_url} alt={part.name} className="w-full h-32 object-contain mt-2" />
          )}
        </div>
      ))}
    </div>
  );
};

export default ModelPartsGrid;






