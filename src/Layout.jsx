// src/Layout.jsx
import React from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col"> {/* no bg-white here */}
      <Header />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
