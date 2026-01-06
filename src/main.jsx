// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { HelmetProvider } from "react-helmet-async"; // ✅ SEO head manager

import Layout from "./Layout";
import HomePage from "./pages/HomePage";
import SingleProduct from "./SingleProduct.jsx"; // unified product page
import ModelPage from "./ModelPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import SuccessPage from "./pages/SuccessPage";
import NotFoundPage from "./pages/404";

// ✅ Public order status page (opaque token)
import OrderStatusPage from "./pages/OrderStatusPage";

// ✅ Load Cookiebot only on real site routes (not 404)
import CookiebotLoader from "./components/CookiebotLoader";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <CartProvider>
        <BrowserRouter>
          {/* ✅ Mount CookiebotLoader at router level so it can read location,
              and it will self-skip on 404/junk paths */}
          <CookiebotLoader />

          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />

              {/* ✅ Facet links: support /grid as an alias to the PartsExplorer */}
              <Route path="/grid" element={<HomePage />} />

              {/* ✅ Public order status page (opaque token) */}
              <Route path="/order/:token" element={<OrderStatusPage />} />

              {/* Unified product page: works for both retail + refurb */}
              <Route path="/parts/:mpn" element={<SingleProduct />} />
              <Route path="/refurb/:mpn" element={<SingleProduct />} />

              <Route path="/model" element={<ModelPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/success" element={<SuccessPage />} />
            </Route>

            {/* ✅ 404 is outside Layout. CookiebotLoader will not load on this path. */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </HelmetProvider>
  </React.StrictMode>
);
