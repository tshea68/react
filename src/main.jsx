// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { HelmetProvider } from "react-helmet-async";

import Layout from "./Layout";
import HomePage from "./pages/HomePage";
import SingleProduct from "./SingleProduct.jsx";
import ModelPage from "./ModelPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import SuccessPage from "./pages/SuccessPage";
import NotFoundPage from "./pages/404";
import DevComponentsPage from "./pages/DevComponentsPage";

import OrderStatusPage from "./pages/OrderStatusPage";
import CookiebotLoader from "./components/CookiebotLoader";
import GTMPageView from "./components/GTMPageView";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <CartProvider>
        <BrowserRouter>
          <CookiebotLoader />
          <GTMPageView />

          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/grid" element={<HomePage />} />
              <Route path="/order/:token" element={<OrderStatusPage />} />
              <Route path="/parts/:mpn" element={<SingleProduct />} />
              <Route path="/refurb/:mpn" element={<SingleProduct />} />
              <Route path="/model" element={<ModelPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/success" element={<SuccessPage />} />
              <Route path="/dev/components" element={<DevComponentsPage />} />

              {/* ✅ Explicit 404 route (for Cloudflare rewrites) */}
              <Route path="/404" element={<NotFoundPage />} />

              {/* ✅ Catch-all 404 now INSIDE Layout so header shows */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* ❌ Remove the old outside-layout wildcard */}
            {/* <Route path="*" element={<NotFoundPage />} /> */}
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </HelmetProvider>
  </React.StrictMode>
);
