// src/pages/DevComponentsPage.jsx
import React from "react";
import { Link } from "react-router-dom";

// Import any components you want to test
import PartsOffersSearchBox from "../components/PartsOffersSearchBox";
// import ModelSearchBox from "../components/ModelSearchBox";
// import RefurbBadge from "../components/RefurbBadge";

export default function DevComponentsPage() {
  // Simple gate: require ?key=apg (change this to something you prefer)
  const params = new URLSearchParams(window.location.search);
  const ok = params.get("key") === "apg";

  if (!ok) {
    return (
      <div className="min-h-screen bg-[#001F3F] text-white p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold">Dev Components</h1>
          <p className="mt-2 text-white/80">
            Unauthorized. Add <span className="font-mono">?key=apg</span>.
          </p>
          <p className="mt-4">
            <Link className="underline" to="/">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#001F3F] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Dev Components</h1>
          <Link className="underline" to="/">
            Back to site
          </Link>
        </div>

        {/* Section wrapper */}
        <section className="rounded-lg border border-white/20 bg-white/5 p-4">
          <div className="text-sm font-semibold mb-3">Parts / Offers SearchBox</div>
          <PartsOffersSearchBox />
        </section>

        {/* Add more sections as you build more components */}
        {/*
        <section className="rounded-lg border border-white/20 bg-white/5 p-4">
          <div className="text-sm font-semibold mb-3">Model SearchBox</div>
          <ModelSearchBox />
        </section>
        */}
      </div>
    </div>
  );
}
