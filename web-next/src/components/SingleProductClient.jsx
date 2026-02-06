"use client";

import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// IMPORTANT: we are reusing the existing React page you already built
import SingleProduct from "../SingleProduct.jsx";

export default function SingleProductClient({ mpn, mode }) {
  const safeMpn = mpn || "";
  const initialPath = mode === "refurb"
    ? `/refurb/${encodeURIComponent(safeMpn)}`
    : `/parts/${encodeURIComponent(safeMpn)}`;

  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/parts/:mpn" element={<SingleProduct />} />
        <Route path="/refurb/:mpn" element={<SingleProduct />} />
      </Routes>
    </MemoryRouter>
  );
}
