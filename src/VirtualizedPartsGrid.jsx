// src/VirtualizedPartsGrid.jsx
import React, { useEffect } from "react";
import { FixedSizeGrid as Grid } from "react-window";

const COLUMN_COUNT = 6;
const CARD_HEIGHT = 220;
const CARD_WIDTH = 250;

const VirtualizedPartsGrid = ({ parts }) => {
  const rowCount = Math.ceil(parts.length / COLUMN_COUNT);

  useEffect(() => {
    console.log("🧮 Virtualized grid initialized with", parts.length, "parts");
  }, [parts]);

  const Cell = ({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * COLUMN_COUNT + columnIndex;
    const part = parts[index];
    if (!part) return null;

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
      <div style={style} className="p-2">
        <div className="border rounded p-4 flex flex-col h-full">
          <div className="font-semibold text-sm mb-1">{part.name}</div>
          <div className="text-xs text-gray-500 mb-1">MPN: {part.mpn}</div>
          {part.price && (
            <div className="text-green-700 font-bold mb-1">${part.price}</div>
          )}
          <span className={`text-xs px-2 py-1 rounded-full w-fit ${stockClass}`}>{stockLabel}</span>
        </div>
      </div>
    );
  };

  return (
    <Grid
      columnCount={COLUMN_COUNT}
      columnWidth={CARD_WIDTH}
      height={700}
      rowCount={rowCount}
      rowHeight={CARD_HEIGHT}
      width={COLUMN_COUNT * CARD_WIDTH}
    >
      {Cell}
    </Grid>
  );
};

export default VirtualizedPartsGrid;



