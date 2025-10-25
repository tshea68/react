// src/pages/HomePage.jsx
import React from "react";
import BrandLogoSliderVertical from "../components/BrandLogoSliderVertical";
import PartsExplorer from "../components/PartsExplorer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
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
          <div className="absolute inset-0 bg-black bg-opacity-70 z-0" />

          {/* FULL-WIDTH HERO CONTENT */}
          <div className="relative z-10 flex flex-row items-stretch w-full min-h-[480px]">
            {/* LEFT & CENTER content constrained in width */}
            <div className="flex flex-col md:flex-row justify-between w-[80%] mx-auto px-4">
              {/* LEFT TEXT BLOCK */}
              <div className="flex flex-col justify-center w-full md:w-1/2 pr-8">
                <p className="text-sm uppercase tracking-wide text-gray-300 mb-2">
                  New and Refurbished Home Appliance Parts
                </p>
                <h1 className="font-bold leading-tight mb-4 text-3xl md:text-5xl xl:text-6xl">
                  If We Don’t
                  <br />
                  Have Your Part
                  <br />....It Doesn’t Exist.
                </h1>
                <p className="text-lg md:text-xl mt-6 max-w-2xl">
                  The largest selection of new and refurbished OEM appliance
                  parts anywhere.
                </p>
              </div>

              {/* MIDDLE QUOTE & IMAGE */}
              <div className="flex flex-col justify-between w-full md:w-1/2">
                <div>
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
                  className="mt-6 self-end w-[160px] md:w-[200px] h-auto object-contain"
                  src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/founder2-200x300.webp"
                  alt="Derek Gould"
                  width="200"
                  height="300"
                />
              </div>
            </div>

            {/* RIGHT COLUMN: fixed-width slider, full height, flush right */}
            <div className="hidden md:flex absolute top-0 right-0 h-full w-[220px] bg-white shadow-lg">
              <BrandLogoSliderVertical />
            </div>
          </div>
        </section>

        {/* PARTS EXPLORER SECTION */}
        <section className="py-10">
          <PartsExplorer />
        </section>
      </main>
    </div>
  );
}
