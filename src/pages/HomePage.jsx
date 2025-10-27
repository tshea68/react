// src/pages/HomePage.jsx
import React from "react";
import BrandLogoSliderVertical from "../components/BrandLogoSliderVertical";
import PartsExplorer from "../components/PartsExplorer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#001b36] text-white">
      <main className="flex-grow">
        {/* HERO SECTION */}
        <section
          className="relative text-white"
          style={{
            backgroundImage:
              'url("https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/adrian-sulyok-sczNLg6rrhQ-unsplash-scaled.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center",
            minHeight: "480px",
          }}
        >
          {/* dark overlay over the background image */}
          <div className="absolute inset-0 bg-black bg-opacity-70 z-0" />

          {/* Layer that holds both the hero content and the right rail */}
          <div className="relative z-10 w-full min-h-[480px]">
            {/* MAIN HERO CONTENT (headline / copy / derek) */}
            {/* pr-[240px] reserves space so content doesn't run under the right rail */}
            <div
              className="
                w-[80%]
                mx-auto
                px-4
                min-h-[480px]
                flex
                flex-col
                md:flex-row
                justify-between
                pr-[240px]
              "
            >
              {/* LEFT BLOCK: headline & subhead */}
              <div className="flex flex-col justify-center w-full md:w-1/2 md:pr-8">
                <p className="text-sm uppercase tracking-wide text-gray-300 mb-4">
                  NEW AND REFURBISHED HOME APPLIANCE PARTS
                </p>

                <h1 className="font-bold leading-tight mb-6 text-3xl md:text-5xl xl:text-6xl">
                  If We Don’t
                  <br />
                  Have Your Part
                  <br />....It Doesn’t Exist.
                </h1>

                <p className="text-lg md:text-xl max-w-2xl">
                  The largest selection of new and refurbished OEM appliance
                  parts anywhere.
                </p>
              </div>

              {/* RIGHT BLOCK: quote + Derek */}
              <div className="flex flex-col justify-between w-full md:w-1/2 mt-10 md:mt-0">
                <div className="text-base leading-relaxed md:pr-4">
                  <p>
                    " We believe customers should be able to fix their current
                    appliance, no matter how old it is, so we must carry both
                    new &amp; refurbished parts. Refurbished doesn’t mean risky.
                    Every board we ship has been thoroughly inspected and tested
                    for reliability — and, on the rare occasion the part doesn’t
                    work, we always make it right."
                  </p>
                  <p className="font-bold mt-4">
                    Derek Gould, Head Appliance Geek &amp; CEO
                  </p>
                </div>

                <img
                  className="mt-8 self-end w-[160px] md:w-[200px] h-auto object-contain"
                  src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/founder2-200x300.webp"
                  alt="Derek Gould"
                  width="200"
                  height="300"
                />
              </div>
            </div>

            {/* RIGHT RAIL (BRANDS COLUMN) */}
            {/* This sits flush to the right of the viewport, full hero height */}
            <div
              className="
                hidden
                md:flex
                absolute
                top-0
                right-0
                h-full
                w-[220px]
                bg-white
                text-black
                shadow-lg
                border
                border-gray-200
                items-stretch
                justify-center
                z-20
              "
            >
              <div className="w-full h-full p-3 overflow-hidden flex flex-col">
                {/* Header text so this doesn't look like an empty white bar */}
                <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide pb-2 border-b border-gray-200 text-center">
                  Brands we carry
                </div>

                {/* Main scroll area for logos */}
                <div className="flex-1 overflow-hidden">
                  <BrandLogoSliderVertical />
                </div>

                {/* Footer text so the column feels intentional / anchored */}
                <div className="pt-2 text-[10px] text-gray-500 text-center border-t border-gray-200">
                  OEM & Refurb
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PARTS EXPLORER SECTION */}
        {/* Give this the same dark navy background and remove any white gap */}
        <section className="bg-[#001b36] text-white pt-2 pb-10">
          <PartsExplorer />
        </section>
      </main>
    </div>
  );
}
