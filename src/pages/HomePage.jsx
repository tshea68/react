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
          className="relative text-white py-16"
          style={{
            backgroundImage:
              'url("https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/adrian-sulyok-sczNLg6rrhQ-unsplash-scaled.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center",
            minHeight: "480px", // defines hero band height
          }}
        >
          {/* dark overlay for readability */}
          <div className="absolute inset-0 bg-black bg-opacity-70 z-0" />

          {/* CONTENT WRAPPER */}
          {/* 2-col layout on desktop:
              - left column: headline + quote + Derek
              - right column: brand rail, pinned to right, same height
          */}
          <div className="relative z-10 w-[80%] mx-auto px-4">
            <div
              className="
                grid
                grid-cols-1
                md:grid-cols-[1fr_auto]
                gap-10
                md:min-h-[480px]
                items-start md:items-stretch
              "
            >
              {/* LEFT COLUMN: headline + quote + Derek stacked */}
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wide text-gray-300 mb-2">
                    New and Refurbished Home Appliance Parts
                  </p>

                  <h1 className="font-bold leading-tight mb-4 text-3xl pad:text-4xl md:text-4xl lg:text-5xl xl:text-6xl">
                    If We Don’t
                    <br />
                    Have Your
                    <br />
                    Part
                    <br />
                    ....It Doesn’t
                    <br />
                    Exist.
                  </h1>

                  <p className="text-lg pad:text-xl md:text-xl lg:text-2xl text-white mt-6 max-w-2xl">
                    The largest selection of new and refurbished OEM appliance
                    parts anywhere.
                  </p>

                  <div className="text-white text-base leading-relaxed mt-10 max-w-xl">
                    <p>
                      " We believe customers should be able to fix their
                      current appliance, no matter how old it is, so we must
                      carry both new &amp; refurbished parts. Refurbished
                      doesn’t mean risky. Every board we ship has been
                      thoroughly inspected and tested for reliability — and, on
                      the rare occasion the part doesn’t work, we always make
                      it right."
                    </p>
                    <p className="font-bold mt-4">
                      Derek Gould, Head Appliance Geek &amp; CEO
                    </p>
                  </div>
                </div>

                <div className="mt-10 flex md:block">
                  <img
                    className="ml-auto w-[140px] md:w-[180px] lg:w-[200px] h-auto object-contain"
                    src="https://appliancepartgeeks.batterypointcapital.co/wp-content/uploads/2025/05/founder2-200x300.webp"
                    alt="Derek Gould"
                    width="200"
                    height="300"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: full-height brand rail, flush right */}
              <div
                className="
                  flex
                  justify-end
                  items-stretch
                "
              >
                {/* The rail will stretch to this column's full height,
                    and this column's height is locked by md:min-h-[480px] on parent grid.
                */}
                <BrandLogoSliderVertical />
              </div>
            </div>
          </div>
        </section>

        {/* PARTS EXPLORER SECTION */}
        <section className="py-10 p-0 m-0">
          <PartsExplorer />
        </section>
      </main>
    </div>
  );
}
