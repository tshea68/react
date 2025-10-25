// src/pages/HomePage.jsx
import React from "react";
import BrandLogoSlider from "../components/BrandLogoSlider";
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
          <div className="absolute inset-0 bg-black bg-opacity-70 z-0" />
          <div className="relative z-10 w-[80%] mx-auto px-4 flex flex-col md:flex-row justify-between">
            <div className="w-full md:w-2/3">
              <p className="text-sm uppercase tracking-wide text-gray-300 mb-2">
                New and Refurbished Home Appliance Parts
              </p>
              <h1 className="font-bold leading-tight mb-4 text-3xl pad:text-4xl md:text-5xl desk:text-6xl">
                If We Don’t Have Your Part
                <br />
                ....It Doesn’t Exist.
              </h1>
              <p className="text-lg pad:text-xl md:text-2xl text-white mt-6 max-w-2xl">
                The largest selection of new and refurbished OEM appliance parts
                anywhere.
              </p>
            </div>

            <div
              className="w-full md:w-1/3 mt-10 md:mt-0 md:pl-8"
              style={{ marginBottom: "-70px" }}
            >
              <div className="bg-transparent text-white text-base leading-relaxed flex flex-col phone:min-h-[420px] pad:min-h-[480px]">
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
                  className="mt-auto self-end w-[160px] pad:w-[200px] h-auto object-contain"
                  src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/founder2-200x300.webp"
                  alt="Derek Gould"
                  width="200"
                  height="300"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Brand logos */}
        <section className="bg-white py-6">
          <div className="w-[80%] mx-auto px-4">
            <BrandLogoSlider />
          </div>
        </section>

        {/* PartsExplorer grid */}
        {/* IMPORTANT: remove bg-white wrapper here.
           Let PartsExplorer paint its own dark blue full-bleed background.
        */}
        <section className="py-10 p-0 m-0">
          <PartsExplorer />
        </section>
      </main>
    </div>
  );
}
