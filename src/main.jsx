// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";

import Layout from "./Layout"; // ⬅ header/footer wrapper
import HomePage from "./pages/HomePage"; // ⬅ correct homepage
import SingleProduct from "./singleproduct";
import ModelPage from "./ModelPage";
import CartPage from "./pages/CartPage";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/parts/:mpn" element={<Layout><SingleProduct /></Layout>} />
          <Route path="/model" element={<Layout><ModelPage /></Layout>} />
          <Route path="/cart" element={<Layout><CartPage /></Layout>} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  </React.StrictMode>
);
