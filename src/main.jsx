import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import SingleProduct from "./singleproduct"; // adjust path if needed
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/part/:mpn" element={<SingleProduct />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);





