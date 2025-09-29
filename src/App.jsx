import React from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ModelPage from "./ModelPage";
import SingleProduct from "./SingleProduct";
import Header from "./components/Header";
import Footer from "./components/Footer";
import RefurbProduct from "./RefurbProduct";
import SuccessPage from "./pages/SuccessPage"; // ← added
import CheckoutPage from "./pages/CheckoutPage";

const App = () => {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/model" element={<ModelPage />} />
        <Route path="/parts/:mpn" element={<SingleProduct />} />
        <Route path="/refurb/:mpn" element={<SingleProduct />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/success" element={<SuccessPage />} /> {/* ← added */}
      </Routes>
      <Footer />
    </div>
  );
};

export default App;
