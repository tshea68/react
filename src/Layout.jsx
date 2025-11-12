// src/Layout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";

export default function Layout({ children }) {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Works whether Layout is used as a wrapper or as a route element */}
        {children ?? <Outlet />}
      </main>
      <Footer />
    </div>
  );
}

