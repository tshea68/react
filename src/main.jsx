// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";

import Layout from "./Layout";
import HomePage from "./pages/HomePage";
import ModelPage from "./ModelPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import SuccessPage from "./pages/SuccessPage";
import PartsExplorerPage from "./pages/PartsExplorerPage.jsx";

// 🔁 Unified product page
import SingleProduct from "./SingleProduct.jsx"; // <- the single page to use for both routes

function NotFound() {
  return <div className="p-6 text-sm text-gray-600">Page not found.</div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Layout>
                <HomePage />
              </Layout>
            }
          />

          {/* Both OEM and Refurb routes go to the same SingleProduct page */}
          <Route
            path="/parts/:mpn"
            element={
              <Layout>
                <SingleProduct />
              </Layout>
            }
          />
          <Route
            path="/refurb/:mpn"
            element={
              <Layout>
                <SingleProduct />
              </Layout>
            }
          />

          <Route
            path="/model"
            element={
              <Layout>
                <ModelPage />
              </Layout>
            }
          />

          <Route
            path="/cart"
            element={
              <Layout>
                <CartPage />
              </Layout>
            }
          />

          <Route
            path="/checkout"
            element={
              <Layout>
                <CheckoutPage />
              </Layout>
            }
          />

          <Route
            path="/grid"
            element={
              <Layout>
                <PartsExplorerPage />
              </Layout>
            }
          />

          <Route
            path="/success"
            element={
              <Layout>
                <SuccessPage />
              </Layout>
            }
          />

          <Route
            path="*"
            element={
              <Layout>
                <NotFound />
              </Layout>
            }
          />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  </React.StrictMode>
);
