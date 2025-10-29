// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";

import Layout from "./Layout";
import HomePage from "./pages/HomePage";
import SingleProductRetail from "./components/SingleProductRetail.jsx";
import SingleProductOffer from "./components/SingleProductOffer.jsx";
import ModelPage from "./ModelPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import SuccessPage from "./pages/SuccessPage";
import PartsExplorerPage from "./pages/PartsExplorerPage.jsx";

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

          {/* OEM / regular part detail page */}
          <Route
            path="/parts/:mpn"
            element={
              <Layout>
                <SingleProductRetail />
              </Layout>
            }
          />

          {/* Refurb / marketplace offer detail page */}
          <Route
            path="/refurb/:mpn"
            element={
              <Layout>
                <SingleProductOffer />
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
        </Routes>
      </BrowserRouter>
    </CartProvider>
  </React.StrictMode>
);
