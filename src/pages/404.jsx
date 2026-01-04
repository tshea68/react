// src/pages/404.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import SEO from "../seo/SEO";

import BrandLogoSliderVertical from "../components/BrandLogoSliderVertical";
import PartsExplorer from "../components/PartsExplorer";

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#001b36]">
      {/* ✅ Keep SEO, but noindex this slug in your SEO map if you support it */}
      <SEO slug="404" pathname={location.pathname} />

      <main className="flex-grow">
        {/* HERO (same as HomePage background) */}
        <section
          className="relative text-white"
          style={{
            backgroundImage:
              'url("https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/adrian-sulyok-sczNLg6rrhQ-unsplash-scaled.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/70" />

          {/* Content wrapper */}
          <div className="relative z-10">
            <div className="w-[90%] max-w-[1400px] mx-auto px-4 lg:pr-[280px]">
              <div
                className="grid grid-cols-1 lg:grid-cols-2 gap-10"
                style={{ alignItems: "stretch" }}
              >
                {/* LEFT: 404 message (your request) */}
                <div className="flex items-center py-8 lg:py-10">
                  <div>
                    <p className="text-sm uppercase tracking-wide text-gray-300 mb-4">
                      PAGE NOT FOUND (404)
                    </p>

                    <h1 className="font-bold leading-tight mb-6 text-3xl md:text-5xl xl:text-6xl">
                      You’re Lost.
                      <br />
                      This Page
                      <br />
                      Doesn’t Exist.
                    </h1>

                    <p className="text-lg md:text-xl text-white/95">
                      Try searching by model number or part number below — we’ll
                      get you to the right place.
                    </p>
                  </div>
                </div>

                {/* RIGHT: removed Derek quote + image (your request) */}
                <div className="hidden lg:block" />
              </div>
            </div>

            {/* BRAND RAIL (keep, same as HomePage) */}
            <div className="hidden lg:block absolute right-8 top-0 bottom-0 w-[220px]">
              <BrandLogoSliderVertical />
            </div>
          </div>
        </section>

        {/* PARTS EXPLORER (same as HomePage) */}
        <section className="relative">
          <div className="h-6" />
          <div className="w-[90%] max-w-[1200px] mx-auto">
            <div className="border-t border-white/10 mb-4" />
            <PartsExplorer />
          </div>
          <div className="pb-10" />
        </section>
      </main>
    </div>
  );
}
