// src/pages/HomePage.jsx
import React from "react";

export default function HomePage() {
  return (
    <div className="bg-white min-h-[60vh]">
      <div className="bg-emerald-600 text-white text-sm px-3 py-2">
        HomePage mounted ✅
      </div>

      <section className="py-8">
        <div className="w-[80%] mx-auto">
          <h1 className="text-2xl font-bold">Content renders</h1>
          <p className="text-gray-700">
            If you can read this, routing + Layout children are working.
          </p>
        </div>
      </section>
    </div>
  );
}
