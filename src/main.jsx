// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";

import Layout from "./Layout";
import HomePage from "./pages/HomePage";
import SingleProduct from "./SingleProduct.jsx"; // unified product page
import ModelPage from "./ModelPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import SuccessPage from "./pages/SuccessPage";

// ✅ Public order status page (opaque token)
import OrderStatusPage from "./pages/OrderStatusPage";

function NotFound() {
  return <div className="p-6 text-sm text-gray-600">Page not found.</div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />

            {/* ✅ Public order status page (opaque token) */}
            <Route path="/order/:token" element={<OrderStatusPage />} />

            {/* Unified product page: works for both retail + refurb */}
            <Route path="/parts/:mpn" element={<SingleProduct />} />
            <Route path="/refurb/:mpn" element={<SingleProduct />} />

            <Route path="/model" element={<ModelPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/success" element={<SuccessPage />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CartProvider>
  </React.StrictMode>
);
