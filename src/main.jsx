// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";

import Layout from "./Layout";
import HomePage from "./pages/HomePage";
import SingleProduct from "./SingleProduct";
import ModelPage from "./ModelPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import SuccessPage from "./pages/SuccessPage";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CartProvider>
      <BrowserRouter>
        <Routes>
          {/* Wrap all app routes with the Layout. Layout should render <Outlet /> */}
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/parts/:mpn" element={<SingleProduct />} />
            <Route path="/refurb/:mpn" element={<SingleProduct />} />
            <Route path="/model" element={<ModelPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/success" element={<SuccessPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CartProvider>
  </React.StrictMode>
);
