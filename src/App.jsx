import React from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ModelPage from "./ModelPage";
import SingleProduct from "./SingleProduct";
import Header from "./components/Header";
import Footer from "./components/Footer";

const App = () => {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/model" element={<ModelPage />} />
        <Route path="/parts/:mpn" element={<SingleProduct />} />
      </Routes>
      <Footer />
    </div>
  );
};

export default App;
