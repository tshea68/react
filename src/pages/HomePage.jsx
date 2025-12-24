// src/pages/HomePage.jsx
import React from "react";
import BrandLogoSliderVertical from "../components/BrandLogoSliderVertical";
import PartsExplorer from "../components/PartsExplorer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#001b36]">
      <main className="flex-grow">
        {/* HERO */}
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
            {/* NOTE: removed global vertical padding (py-*) so each column can own its padding */}
            <div className="w-[90%] max-w-[1400px] mx-auto px-4 lg:pr-[280px]">
              <div
                className="grid grid-cols-1 lg:grid-cols-2 gap-10"
                style={{ alignItems: "stretch" }}
              >
                {/* LEFT: Headline (top + bottom padding) */}
                <div className="flex items-center py-8 lg:py-10">
                  <div>
                    <p className="text-sm uppercase tracking-wide text-gray-300 mb-4">
                      NEW AND REFURBISHED HOME APPLIANCE PARTS
                    </p>

                    <h1 className="font-bold leading-tight mb-6 text-3xl md:text-5xl xl:text-6xl">
                      If We Don’t
                      <br />
                      Have Your Part
                      <br />....It Doesn’t Exist.
                    </h1>

                    <p className="text-lg md:text-xl text-white/95">
                      The largest selection of new and refurbished OEM appliance
                      parts anywhere.
                    </p>
                  </div>
                </div>

                {/* RIGHT: Derek quote (top padding only; no bottom padding) */}
                <div className="hidden lg:flex items-end pt-8 lg:pt-10 pb-0">
                  <div
                    className="text-base leading-relaxed"
                    style={{
                      maxWidth: "520px",
                      lineHeight: 1.4,
                      fontSize: "16px",
                      color: "#fff",
                    }}
                  >
                    <p style={{ marginBottom: "1rem" }}>
                      " We believe customers should be able to fix their current
                      appliance, no matter how old it is, so we must carry both
                      new &amp; refurbished parts. Refurbished doesn’t mean
                      risky. Every board we ship has been thoroughly inspected
                      and
                      <img
                        src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/founder2-200x300.webp"
                        alt="Derek Gould"
                        width="200"
                        height="300"
                        style={{
                          float: "right",
                          margin: "0 0 10px 20px",
                          objectFit: "contain",
                        }}
                      />
                      tested for reliability — and, on the rare occasion the
                      part doesn’t work, we always make it right."
                    </p>

                    <p style={{ fontWeight: 700, marginTop: "1rem" }}>
                      Derek Gould, Head Appliance Geek &amp; CEO
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* BRAND RAIL (desktop only) — flush to hero top/bottom */}
            <div className="hidden lg:block absolute right-8 top-0 bottom-0 w-[220px]">
              <BrandLogoSliderVertical />
            </div>
          </div>
        </section>

        {/* PARTS EXPLORER */}
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
