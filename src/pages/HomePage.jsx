// src/pages/HomePage.jsx
import React from "react";
import BrandLogoSliderVertical from "../components/BrandLogoSliderVertical";
import PartsExplorer from "../components/PartsExplorer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-grow">
        {/* Hero */}
        <section
          className="relative text-white py-16"
          style={{
            backgroundImage:
              'url("https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/adrian-sulyok-sczNLg6rrhQ-unsplash-scaled.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center",
            minHeight: "320px",
          }}
        >
          {/* dark overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-70 z-0" />

          {/* content */}
          <div className="relative z-10 w-[80%] mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* LEFT: headline / promise */}
            <div className="md:col-span-1 flex flex-col">
              <p className="text-sm uppercase tracking-wide text-gray-300 mb-2">
                New and Refurbished Home Appliance Parts
              </p>

              <h1 className="font-bold leading-tight mb-4 text-3xl pad:text-4xl md:text-4xl lg:text-5xl xl:text-6xl">
                If We Don’t Have Your Part
                <br />
                ....It Doesn’t Exist.
              </h1>

              <p className="text-lg pad:text-xl md:text-xl lg:text-2xl text-white mt-6 max-w-2xl">
                The largest selection of new and refurbished OEM appliance
                parts anywhere.
              </p>
            </div>

            {/* MIDDLE: founder quote */}
            <div className="md:col-span-1 flex flex-col justify-between md:pl-4 lg:pl-8">
              <div className="text-white text-base leading-relaxed phone:min-h-[220px] pad:min-h-[260px]">
                <p>
                  " We believe customers should be able to fix their current
                  appliance, no matter how old it is, so we must carry both new
                  &amp; refurbished parts. Refurbished doesn’t mean risky. Every
                  board we ship has been thoroughly inspected and tested for
                  reliability — and, on the rare occasion the part doesn’t work,
                  we always make it right."
                </p>
                <p className="font-bold mt-4">
                  Derek Gould, Head Appliance Geek &amp; CEO
                </p>
              </div>

              <div className="mt-6 flex md:block">
                <img
                  className="ml-auto w-[140px] md:w-[180px] lg:w-[200px] h-auto object-contain"
                  src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/founder2-200x300.webp"
                  alt="Derek Gould"
                  width="200"
                  height="300"
                />
              </div>
            </div>

            {/* RIGHT: vertical brand rail */}
            <div className="md:col-span-1 flex md:justify-end">
              <div className="w-full md:w-auto md:ml-auto flex md:block justify-center">
                <BrandLogoSliderVertical />
              </div>
            </div>
          </div>
        </section>

        {/* We REMOVE the horizontal Brand logos strip
            because brand credibility is now in the hero on the right. */}

        {/* PartsExplorer grid sits immediately after hero now */}
        <section className="py-10 p-0 m-0">
          <PartsExplorer />
        </section>
      </main>
    </div>
  );
}
