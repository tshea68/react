// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";

import Layout from "./Layout";
import HomePage from "./pages/HomePage";
import SingleProduct from "./singleproduct";      // keep your current path/casing
import ModelPage from "./ModelPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";  // ✅ added
import SuccessPage from "./pages/SuccessPage";    // ✅ added

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/parts/:mpn" element={<Layout><SingleProduct /></Layout>} />
          <Route path="/model" element={<Layout><ModelPage /></Layout>} />
          <Route path="/cart" element={<Layout><CartPage /></Layout>} />
          <Route path="/checkout" element={<Layout><CheckoutPage /></Layout>} /> {/* ✅ */}
          <Route path="/success" element={<Layout><SuccessPage /></Layout>} />   {/* ✅ */}
        </Routes>
      </BrowserRouter>
    </CartProvider>
  </React.StrictMode>
);
